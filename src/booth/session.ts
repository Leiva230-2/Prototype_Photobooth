import {
  AFTER_SHOT_MS,
  COUNTDOWN_FROM,
  DECK_TIMEOUT_MS,
  DECKS,
  PROMPT_MS,
  RESULT_MS,
  REVEAL_MS,
  SHOTS,
  type DeckId,
} from './config';
import { FRAMES, roll, type FrameId } from './gacha';
import { Cancelled, sleep as realSleep } from './timing';
import type { GuestIntent } from '../shared/link-protocol';
import { IDLE_VIEW, type GuestView } from '../shared/view';

export interface DeliverInput<Shot> {
  code: string;
  shots: Shot[];
  frame: FrameId;
}

export interface DeliverResult {
  link: string | null;
  stripThumb: string | null;
}

/** Everything the session needs from the outside world, injected so it can be tested. */
export interface SessionDeps<Shot> {
  grab(): Shot;
  deliver(input: DeliverInput<Shot>): Promise<DeliverResult>;
  newCode(): string;
  random(): number;
  log(text: string, level?: 'info' | 'ok' | 'err'): void;
  sleep?(ms: number, signal: AbortSignal): Promise<void>;
}

/**
 * The booth flow as a small state machine:
 * idle → deck → capturing → reveal → result → idle.
 * Both the Mac console and the tablet just render `view`.
 */
export class BoothSession<Shot = unknown> {
  private current: GuestView = IDLE_VIEW;
  private phaseCtl = new AbortController();
  private run = 0;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;

  constructor(
    private readonly deps: SessionDeps<Shot>,
    private readonly onChange: (view: GuestView) => void,
  ) {
    this.sleep = deps.sleep ?? realSleep;
  }

  get view(): GuestView {
    return this.current;
  }

  private set(patch: Partial<GuestView>): void {
    this.current = { ...this.current, ...patch };
    this.onChange(this.current);
  }

  /** Cancels timers and anything in flight for the current phase. */
  private nextPhase(): AbortSignal {
    this.phaseCtl.abort();
    this.phaseCtl = new AbortController();
    return this.phaseCtl.signal;
  }

  /** Goes back to the attract screen after `ms` unless something else happens first. */
  private timeout(ms: number, signal: AbortSignal, reason: string): void {
    this.sleep(ms, signal).then(
      () => {
        this.deps.log(reason);
        this.reset();
      },
      () => {},
    );
  }

  /** Attract screen → deck picker. */
  begin(): void {
    if (this.current.phase !== 'idle') return;
    const signal = this.nextPhase();
    this.current = { ...IDLE_VIEW, flashId: this.current.flashId };
    this.set({ phase: 'deck' });
    this.timeout(DECK_TIMEOUT_MS, signal, 'Tidak ada yang pilih gaya — kembali ke layar awal');
  }

  /** Deck picked → run the capture, gacha and delivery. */
  chooseDeck(deck: DeckId): Promise<void> {
    if (this.current.phase !== 'deck') return Promise.resolve();
    return this.capture(deck);
  }

  /** Mac shortcut (Space): start, or pick the default deck if already on the picker. */
  quickStart(defaultDeck: DeckId): void {
    if (this.current.phase === 'idle') this.begin();
    else if (this.current.phase === 'deck') void this.chooseDeck(defaultDeck);
  }

  handleIntent(intent: GuestIntent, defaultDeck: DeckId): void {
    switch (intent.type) {
      case 'start':
        this.begin();
        break;
      case 'deck':
        void this.chooseDeck(DECKS[intent.deck] ? intent.deck : defaultDeck);
        break;
      case 'cancel':
        if (this.current.phase === 'deck') this.reset();
        break;
      case 'finish':
        if (this.current.phase === 'result') this.reset();
        break;
    }
  }

  /** Operator reset: works in every phase. Delivery keeps running in the background. */
  reset(): void {
    this.nextPhase();
    this.run++;
    this.current = { ...IDLE_VIEW, flashId: this.current.flashId };
    this.onChange(this.current);
  }

  private async capture(deck: DeckId): Promise<void> {
    const signal = this.nextPhase();
    const run = ++this.run;
    const code = this.deps.newCode();
    const shots: Shot[] = [];
    this.deps.log(`Sesi ${code} · gaya ${DECKS[deck].label}`);
    this.set({ phase: 'capturing', deck, code, shot: 0, prompt: null, count: null });

    try {
      for (let i = 0; i < SHOTS; i++) {
        this.set({ shot: i, prompt: DECKS[deck].prompts[i] ?? 'Bebas', count: null });
        await this.sleep(PROMPT_MS, signal);
        for (let n = COUNTDOWN_FROM; n > 0; n--) {
          this.set({ count: n });
          await this.sleep(1000, signal);
        }
        shots.push(this.deps.grab());
        this.set({ count: null, flashId: this.current.flashId + 1 });
        this.deps.log(`Foto ${i + 1}/${SHOTS}`);
        await this.sleep(AFTER_SHOT_MS, signal);
      }
    } catch (err) {
      if (err instanceof Cancelled) {
        this.deps.log('Sesi dibatalkan');
        return;
      }
      throw err;
    }

    // Roll first: the frame is part of the strip, so it has to be known before composing.
    const frame = roll(FRAMES, this.deps.random()).id;
    this.deps.log(`Gacha: frame ${frame}`, 'ok');
    this.set({ phase: 'reveal', frame, prompt: null, count: null, shot: SHOTS, busy: true });

    const minReveal = this.sleep(REVEAL_MS, signal).catch(() => {});
    const delivered = this.deps.deliver({ code, shots, frame }).catch((err: unknown) => {
      this.deps.log(`Gagal menyiapkan hasil: ${err instanceof Error ? err.message : String(err)}`, 'err');
      return { link: null, stripThumb: null } satisfies DeliverResult;
    });
    const [result] = await Promise.all([delivered, minReveal]);

    if (run !== this.run) return; // operator reset during the reveal
    const resultSignal = this.nextPhase();
    this.set({
      phase: 'result',
      busy: false,
      link: result.link,
      stripThumb: result.stripThumb,
      note: result.link ? null : 'QR belum tersedia. Tunjukkan kode ini ke operator ya.',
    });
    this.timeout(RESULT_MS, resultSignal, 'Layar hasil selesai — kembali ke layar awal');
  }
}
