import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { LINK_PATH, type Role } from '../src/shared/link-protocol';

/** Preview frames are dropped for a client that falls this far behind. */
const MAX_BUFFERED_BYTES = 2_000_000;

/**
 * Tiny relay between the Mac console ("host") and the tablet ("guest").
 * Host messages go to every guest, guest messages go to every host, and
 * everyone hears when someone connects or leaves.
 */
export function createLinkHub() {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<WebSocket, Role>();

  const peers = () => {
    let hosts = 0;
    let guests = 0;
    for (const role of clients.values()) role === 'host' ? hosts++ : guests++;
    return { hosts, guests };
  };

  const announcePeers = () => {
    const msg = JSON.stringify({ type: 'peers', ...peers() });
    for (const ws of clients.keys()) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const role: Role =
      new URL(req.url ?? '/', 'http://localhost').searchParams.get('role') === 'host' ? 'host' : 'guest';
    clients.set(ws, role);
    announcePeers();

    ws.on('message', (data: RawData, isBinary: boolean) => {
      for (const [peer, peerRole] of clients) {
        if (peerRole === role || peer.readyState !== WebSocket.OPEN) continue;
        if (isBinary && peer.bufferedAmount > MAX_BUFFERED_BYTES) continue;
        peer.send(data, { binary: isBinary });
      }
    });
    ws.on('close', () => {
      clients.delete(ws);
      announcePeers();
    });
    ws.on('error', () => ws.terminate());
  });

  return {
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    },
    peers,
    close(): void {
      for (const ws of clients.keys()) ws.terminate();
      wss.close();
    },
  };
}

/** Attaches the hub to an HTTP server, leaving every other upgrade (e.g. Vite HMR) alone. */
export function attachLinkHub(server: Server): ReturnType<typeof createLinkHub> {
  const hub = createLinkHub();
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === LINK_PATH) hub.handleUpgrade(req, socket, head);
  });
  return hub;
}

/** Vite plugin: runs the hub inside `npm run dev` and `npm run preview`. */
export function boothLink(): Plugin {
  return {
    name: 'booth-link',
    configureServer(server) {
      if (server.httpServer) attachLinkHub(server.httpServer as Server);
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachLinkHub(server.httpServer as Server);
    },
  };
}
