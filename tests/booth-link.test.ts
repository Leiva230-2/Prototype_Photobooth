import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { attachLinkHub } from '../server/booth-link';
import { LINK_PATH } from '../src/shared/link-protocol';

let server: Server;
let hub: ReturnType<typeof attachLinkHub>;
const sockets: WebSocket[] = [];
const rawSockets = new Set<Socket>();

async function start(): Promise<number> {
  server = createServer();
  server.on('connection', (s: Socket) => {
    rawSockets.add(s);
    s.on('close', () => rawSockets.delete(s));
  });
  hub = attachLinkHub(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return (server.address() as AddressInfo).port;
}

/** Connects and collects every message, so nothing is missed between awaits. */
async function connect(port: number, role: 'host' | 'guest') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${LINK_PATH}?role=${role}`);
  sockets.push(ws);
  const inbox: { data: Buffer; binary: boolean }[] = [];
  ws.on('message', (data: Buffer, binary: boolean) => inbox.push({ data, binary }));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const next = async (pred: (m: { data: Buffer; binary: boolean }) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const idx = inbox.findIndex(pred);
      if (idx >= 0) return inbox.splice(idx, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('timed out waiting for message');
  };
  const nextJson = async (type: string) => {
    const m = await next((m) => !m.binary && JSON.parse(m.data.toString()).type === type);
    return JSON.parse(m.data.toString());
  };
  return { ws, inbox, next, nextJson };
}

afterEach(async () => {
  sockets.splice(0).forEach((s) => s.terminate());
  hub?.close();
  rawSockets.forEach((s) => s.destroy()); // unclaimed upgrades would keep the server open
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
});

describe('booth link hub', () => {
  it('announces who is connected', async () => {
    const port = await start();
    const host = await connect(port, 'host');
    await connect(port, 'guest');
    await host.nextJson('peers'); // host alone
    expect(await host.nextJson('peers')).toEqual({ type: 'peers', hosts: 1, guests: 1 });
  });

  it('routes host → guest and guest → host, never back to the sender', async () => {
    const port = await start();
    const host = await connect(port, 'host');
    const guest = await connect(port, 'guest');
    await guest.nextJson('peers');

    host.ws.send(JSON.stringify({ type: 'state', view: { phase: 'deck' } }));
    expect((await guest.nextJson('state')).view.phase).toBe('deck');

    guest.ws.send(JSON.stringify({ type: 'intent', intent: { type: 'start' } }));
    expect((await host.nextJson('intent')).intent).toEqual({ type: 'start' });

    await new Promise((r) => setTimeout(r, 50));
    expect(host.inbox.some((m) => !m.binary && m.data.toString().includes('"state"'))).toBe(false);
  });

  it('relays binary preview frames to the tablet', async () => {
    const port = await start();
    const host = await connect(port, 'host');
    const guest = await connect(port, 'guest');
    host.ws.send(Buffer.from([0xff, 0xd8, 0xff]), { binary: true });
    const frame = await guest.next((m) => m.binary);
    expect([...frame.data]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('ignores other upgrade paths', async () => {
    const port = await start();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/something-else`);
    sockets.push(ws);
    const outcome = await new Promise<string>((resolve) => {
      ws.once('open', () => resolve('open'));
      ws.once('error', () => resolve('error'));
      setTimeout(() => resolve('pending'), 300);
    });
    expect(outcome).not.toBe('open');
    expect(hub.peers()).toEqual({ hosts: 0, guests: 0 });
  });
});
