import { describe, expect, it, vi } from 'vitest';
import { SHOTS } from '../src/booth/config';
import { BoothSession, type SessionDeps } from '../src/booth/session';
import { Cancelled } from '../src/booth/timing';
import type { GuestView, Phase } from '../src/shared/view';

/** Instant sleep that still honours cancellation. */
async function fastSleep(_ms: number, signal: AbortSignal): Promise<void> {
  await Promise.resolve();
  if (signal.aborted) throw new Cancelled();
}

function setup(overrides: Partial<SessionDeps<number>> = {}) {
  let shotNo = 0;
  const deps: SessionDeps<number> = {
    grab: vi.fn(() => ++shotNo),
    deliver: vi.fn(async () => ({ link: 'https://x.test/g?s=ABC234', stripThumb: 'data:x' })),
    newCode: () => 'ABC234',
    random: () => 0.6, // → 'ungu'
    log: () => {},
    sleep: (ms, signal) => (ms >= 30_000 ? new Promise(() => {}) : fastSleep(ms, signal)),
    ...overrides,
  };
  const views: GuestView[] = [];
  const session = new BoothSession(deps, (v) => views.push(v));
  const phases = () => views.map((v) => v.phase).filter((p, i, a) => p !== a[i - 1]);
  return { deps, session, views, phases };
}

describe('BoothSession', () => {
  it('runs idle → deck → capturing → reveal → result', async () => {
    const { deps, session, phases } = setup();
    session.begin();
    expect(session.view.phase).toBe('deck');
    await session.chooseDeck('COUPLE');

    expect(phases()).toEqual<Phase[]>(['deck', 'capturing', 'reveal', 'result']);
    expect(deps.grab).toHaveBeenCalledTimes(SHOTS);
    expect(deps.deliver).toHaveBeenCalledWith({ code: 'ABC234', shots: [1, 2, 3, 4], frame: 'ungu' });
    expect(session.view).toMatchObject({
      phase: 'result',
      deck: 'COUPLE',
      frame: 'ungu',
      code: 'ABC234',
      link: 'https://x.test/g?s=ABC234',
      busy: false,
      note: null,
    });
    expect(session.view.flashId).toBe(SHOTS);
  });

  it('shows each prompt and a countdown for every shot', async () => {
    const { session, views } = setup();
    session.begin();
    await session.chooseDeck('BESTIE');
    const counts = views.filter((v) => v.phase === 'capturing' && v.count !== null).map((v) => v.count);
    expect(counts).toEqual([3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1]);
    const prompts = new Set(views.map((v) => v.prompt).filter(Boolean));
    expect(prompts.size).toBe(SHOTS);
  });

  it('ignores a deck pick unless the picker is showing', async () => {
    const { deps, session } = setup();
    await session.chooseDeck('CHAOS');
    expect(session.view.phase).toBe('idle');
    expect(deps.grab).not.toHaveBeenCalled();
  });

  it('cancels a capture on reset without taking photos', async () => {
    const { deps, session } = setup();
    session.begin();
    const run = session.chooseDeck('CHAOS');
    session.reset();
    await run;
    expect(session.view.phase).toBe('idle');
    expect(deps.grab).not.toHaveBeenCalled();
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('still reaches the result screen when delivery fails, with a note instead of a QR', async () => {
    const { session } = setup({ deliver: vi.fn(async () => Promise.reject(new Error('offline'))) });
    session.begin();
    await session.chooseDeck('KULIAH');
    expect(session.view.phase).toBe('result');
    expect(session.view.link).toBeNull();
    expect(session.view.note).toMatch(/QR/);
  });

  it('handles guest taps', async () => {
    const { session } = setup();
    session.handleIntent({ type: 'start' }, 'BESTIE');
    expect(session.view.phase).toBe('deck');
    session.handleIntent({ type: 'cancel' }, 'BESTIE');
    expect(session.view.phase).toBe('idle');
    session.handleIntent({ type: 'start' }, 'BESTIE');
    session.handleIntent({ type: 'deck', deck: 'CORPORATE' }, 'BESTIE');
    await vi.waitFor(() => expect(session.view.phase).toBe('result'));
    expect(session.view.deck).toBe('CORPORATE');
    session.handleIntent({ type: 'finish' }, 'BESTIE');
    expect(session.view.phase).toBe('idle');
  });

  it('quickStart opens the picker, then uses the default deck', async () => {
    const { session } = setup();
    session.quickStart('COUPLE');
    expect(session.view.phase).toBe('deck');
    session.quickStart('COUPLE');
    await vi.waitFor(() => expect(session.view.phase).toBe('result'));
    expect(session.view.deck).toBe('COUPLE');
  });
});
