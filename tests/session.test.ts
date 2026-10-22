import { describe, expect, it, vi } from 'vitest';
import { SELECT_TIMEOUT_MS, SHOTS, STRIP_SHOTS } from '../src/booth/config';
import { BoothSession, type SessionDeps } from '../src/booth/session';
import { Cancelled } from '../src/booth/timing';
import type { GuestView, Phase } from '../src/shared/view';

/** Instant sleep that still honours cancellation. */
async function fastSleep(_ms: number, signal: AbortSignal): Promise<void> {
  await Promise.resolve();
  if (signal.aborted) throw new Cancelled();
}

/** Long waits (timeouts) never fire unless a test opts in. */
function setup(overrides: Partial<SessionDeps<number>> = {}, fireTimeouts: number[] = []) {
  let shotNo = 0;
  const deps: SessionDeps<number> = {
    grab: vi.fn(() => ++shotNo),
    thumb: (shot) => `thumb-${shot}`,
    deliver: vi.fn(async () => ({ link: 'https://x.test/g?s=ABC234', stripThumb: 'data:x' })),
    newCode: () => 'ABC234',
    random: () => 0.6, // → 'ungu'
    log: () => {},
    sleep: (ms, signal) =>
      ms >= 30_000 && !fireTimeouts.includes(ms) ? new Promise(() => {}) : fastSleep(ms, signal),
    ...overrides,
  };
  const views: GuestView[] = [];
  const session = new BoothSession(deps, (v) => views.push(v));
  const phases = () => views.map((v) => v.phase).filter((p, i, a) => p !== a[i - 1]);
  return { deps, session, views, phases };
}

async function toSelect(session: BoothSession<number>, deck: 'BESTIE' | 'COUPLE' = 'COUPLE') {
  session.begin();
  await session.chooseDeck(deck);
  expect(session.view.phase).toBe('select');
}

describe('BoothSession', () => {
  it('takes every shot, then waits on the selection screen with thumbnails', async () => {
    const { deps, session } = setup();
    await toSelect(session);
    expect(deps.grab).toHaveBeenCalledTimes(SHOTS);
    expect(session.view.thumbs).toEqual(Array.from({ length: SHOTS }, (_, i) => `thumb-${i + 1}`));
    expect(session.view.selected).toEqual([]);
    expect(session.view.flashId).toBe(SHOTS);
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('shows a different prompt and a countdown for every shot', async () => {
    const { session, views } = setup();
    await toSelect(session, 'BESTIE');
    const counts = views.filter((v) => v.phase === 'capturing' && v.count !== null).map((v) => v.count);
    expect(counts).toEqual(Array.from({ length: SHOTS }, () => [3, 2, 1]).flat());
    const prompts = new Set(views.map((v) => v.prompt).filter(Boolean));
    expect(prompts.size).toBe(SHOTS);
  });

  it('runs a standard session: pick 4 → reveal → result', async () => {
    const { deps, session, phases } = setup();
    await toSelect(session);
    for (const i of [6, 1, 3, 4]) session.toggle(i);
    expect(session.view.selected).toEqual([1, 3, 4, 6]); // kept in shooting order
    await session.confirm();

    expect(phases()).toEqual<Phase[]>(['deck', 'capturing', 'select', 'reveal', 'result']);
    expect(deps.deliver).toHaveBeenCalledWith({
      code: 'ABC234',
      shots: [1, 2, 3, 4, 5, 6, 7, 8],
      chosen: [1, 3, 4, 6],
      pkg: 'standard',
      frame: 'ungu',
    });
    expect(session.view).toMatchObject({ phase: 'result', pkg: 'standard', link: 'https://x.test/g?s=ABC234' });
    expect(session.view.thumbs).toEqual([]); // dropped once no longer needed
  });

  it('caps the pick at four and lets the guest unpick', async () => {
    const { session } = setup();
    await toSelect(session);
    for (const i of [0, 1, 2, 3, 4]) session.toggle(i);
    expect(session.view.selected).toEqual([0, 1, 2, 3]);
    session.toggle(2);
    session.toggle(7);
    expect(session.view.selected).toEqual([0, 1, 3, 7]);
    session.toggle(99);
    expect(session.view.selected).toHaveLength(STRIP_SHOTS);
  });

  it('will not continue with fewer than four photos', async () => {
    const { deps, session } = setup();
    await toSelect(session);
    session.toggle(0);
    await session.confirm();
    expect(session.view.phase).toBe('select');
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('upgrades to the big print only after the operator confirms', async () => {
    const { deps, session } = setup();
    await toSelect(session);
    session.handleIntent({ type: 'upgrade' }, 'BESTIE');
    expect(session.view.upgradePending).toBe(true);
    session.toggle(0); // picking is frozen while waiting
    expect(session.view.selected).toEqual([]);

    await session.approveUpgrade();
    expect(deps.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ pkg: 'big', chosen: [0, 1, 2, 3, 4, 5, 6, 7] }),
    );
    expect(session.view).toMatchObject({ phase: 'result', pkg: 'big', upgradePending: false });
  });

  it('goes back to picking when the upgrade is cancelled', async () => {
    const { deps, session } = setup();
    await toSelect(session);
    session.handleIntent({ type: 'upgrade' }, 'BESTIE');
    session.handleIntent({ type: 'cancelUpgrade' }, 'BESTIE');
    expect(session.view.upgradePending).toBe(false);
    for (const i of [0, 2, 4, 6]) session.handleIntent({ type: 'toggle', index: i }, 'BESTIE');
    session.handleIntent({ type: 'confirm' }, 'BESTIE');
    await vi.waitFor(() => expect(session.view.phase).toBe('result'));
    expect(deps.deliver).toHaveBeenCalledWith(expect.objectContaining({ pkg: 'standard', chosen: [0, 2, 4, 6] }));
  });

  it('fills the strip with the earliest photos when nobody finishes picking', async () => {
    const { deps, session } = setup({}, [SELECT_TIMEOUT_MS]);
    session.begin();
    // The timeout fires as soon as the selection screen opens, so pick inside the same tick.
    const run = session.chooseDeck('CHAOS');
    await vi.waitFor(() => expect(deps.deliver).toHaveBeenCalled());
    await run;
    expect(deps.deliver).toHaveBeenCalledWith(expect.objectContaining({ pkg: 'standard', chosen: [0, 1, 2, 3] }));
  });

  it('cancels a capture on reset without taking photos', async () => {
    const { deps, session } = setup();
    session.begin();
    const run = session.chooseDeck('CHAOS');
    session.reset();
    await run;
    expect(session.view.phase).toBe('idle');
    expect(deps.grab).not.toHaveBeenCalled();
  });

  it('a reset on the selection screen drops the photos', async () => {
    const { deps, session } = setup();
    await toSelect(session);
    session.reset();
    expect(session.view.phase).toBe('idle');
    expect(session.view.thumbs).toEqual([]);
    await session.approveUpgrade();
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('still reaches the result screen when delivery fails, with a note instead of a QR', async () => {
    const { session } = setup({ deliver: vi.fn(async () => Promise.reject(new Error('offline'))) });
    await toSelect(session);
    for (const i of [0, 1, 2, 3]) session.toggle(i);
    await session.confirm();
    expect(session.view.phase).toBe('result');
    expect(session.view.link).toBeNull();
    expect(session.view.note).toMatch(/QR/);
  });

  it('handles the start, cancel and finish taps', async () => {
    const { session } = setup();
    session.handleIntent({ type: 'start' }, 'BESTIE');
    expect(session.view.phase).toBe('deck');
    session.handleIntent({ type: 'cancel' }, 'BESTIE');
    expect(session.view.phase).toBe('idle');
    session.quickStart('COUPLE');
    session.quickStart('COUPLE');
    await vi.waitFor(() => expect(session.view.phase).toBe('select'));
    expect(session.view.deck).toBe('COUPLE');
    for (const i of [0, 1, 2, 3]) session.toggle(i);
    await session.confirm();
    session.handleIntent({ type: 'finish' }, 'BESTIE');
    expect(session.view.phase).toBe('idle');
  });
});
