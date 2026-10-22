import {
  AFTER_SHOT_MS,
  COUNTDOWN_FROM,
  DECK_TIMEOUT_MS,
  DECKS,
  PROMPT_MS,
  RESULT_MS,
  REVEAL_MS,
  SELECT_TIMEOUT_MS,
  SHOTS,
  STRIP_SHOTS,
  type DeckId,
} from './config';
import { FRAMES, roll, type FrameId } from './gacha';
import { Cancelled, sleep as realSleep } from './timing';
import type { GuestIntent } from '../shared/link-protocol';
import { IDLE_VIEW, type GuestView, type PrintPackage } from '../shared/view';

export interface DeliverInput<Shot> {
  code: string;
  /** Every shot taken, in order. */
  shots: Shot[];
  /** Indexes of the shots on the strip (standard) or all of them (big). */
  chosen: number[];
  pkg: PrintPackage;
  frame: FrameId;
}

export interface DeliverResult {
  link: string | null;
  stripThumb: string | null;
}

/** Everything the session needs from the outside world, injected so it can be tested. */
export interface SessionDeps<Shot> {
  grab(): Shot;
  /** Small preview of a shot for the selection screen (a JPEG data URL). */
  thumb(shot: Shot): string;
  deliver(input: DeliverInput<Shot>): Promise<DeliverResult>;
  newCode(): string;
  random(): number;
  log(text: string, level?: 'info' | 'ok' | 'err'): void;
  sleep?(ms: number, signal: AbortSignal): Promise<void>;
}

const ALL_SHOTS = Array.from({ length: SHOTS }, (_, i) => i);

/**
 * The booth flow as a small state machine:
 * idle → deck → capturing → select → reveal → result → idle.
 * Both the Mac console and the tablet just render `view`.
 */
export class BoothSession<Shot = unknown> {
  private current: GuestView = IDLE_VIEW;
  private phaseCtl = new AbortController();
  private run = 0;
  /** The session waiting on the selection screen. */
  private taken: { code: string; shots: Shot[]; run: number } | null = null;
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

  /** Runs `then` after `ms` unless the phase changes first. */
  private after(ms: number, signal: AbortSignal, then: () => void): void {
    this.sleep(ms, signal).then(then, () => {});
  }

  /** Attract screen → deck picker. */
  begin(): void {
    if (this.current.phase !== 'idle') return;
    const signal = this.nextPhase();
    this.current = { ...IDLE_VIEW, flashId: this.current.flashId };
    this.set({ phase: 'deck' });
    this.after(DECK_TIMEOUT_MS, signal, () => {
      this.deps.log('Tidak ada yang pilih gaya — kembali ke layar awal');
      this.reset();
    });
  }

  /** Deck picked → take the photos, then show the selection screen. */
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
      case 'toggle':
        this.toggle(intent.index);
        break;
      case 'confirm':
        void this.confirm();
        break;
      case 'upgrade':
        this.requestUpgrade();
        break;
      case 'cancelUpgrade':
        this.declineUpgrade();
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
    this.taken = null;
    this.current = { ...IDLE_VIEW, flashId: this.current.flashId };
    this.onChange(this.current);
  }

  /* ---------- Selection ---------- */

  toggle(index: number): void {
    const v = this.current;
    if (v.phase !== 'select' || v.upgradePending || !Number.isInteger(index)) return;
    if (index < 0 || index >= SHOTS) return;
    if (v.selected.includes(index)) {
      this.set({ selected: v.selected.filter((i) => i !== index) });
    } else if (v.selected.length < STRIP_SHOTS) {
      this.set({ selected: [...v.selected, index].sort((a, b) => a - b) });
    }
  }

  /** Guest is done picking. Only works with exactly STRIP_SHOTS photos chosen. */
  confirm(): Promise<void> {
    const v = this.current;
    if (v.phase !== 'select' || v.upgradePending || v.selected.length !== STRIP_SHOTS) {
      return Promise.resolve();
    }
    return this.finish('standard', v.selected);
  }

  /** Guest wants the big print. Waits for the operator to confirm payment. */
  requestUpgrade(): void {
    if (this.current.phase !== 'select' || this.current.upgradePending) return;
    this.nextPhase(); // no auto-continue while the operator is busy with payment
    this.deps.log('Tamu minta versi besar — konfirmasi pembayaran di Mac', 'ok');
    this.set({ upgradePending: true });
  }

  /** Operator: payment received, print all photos on the big sheet. */
  approveUpgrade(): Promise<void> {
    if (this.current.phase !== 'select') return Promise.resolve();
    this.deps.log('Versi besar dikonfirmasi');
    return this.finish('big', ALL_SHOTS);
  }

  /** Operator declined, or the guest changed their mind: back to picking 4. */
  declineUpgrade(): void {
    if (this.current.phase !== 'select' || !this.current.upgradePending) return;
    this.set({ upgradePending: false });
    this.armSelectTimeout();
  }

  private armSelectTimeout(): void {
    const signal = this.nextPhase();
    this.after(SELECT_TIMEOUT_MS, signal, () => {
      // Fill the strip with the earliest photos the guest didn't pick, then carry on.
      const picked = [...this.current.selected];
      for (const i of ALL_SHOTS) if (picked.length < STRIP_SHOTS && !picked.includes(i)) picked.push(i);
      this.deps.log('Waktu pilih foto habis — dipilih otomatis');
      void this.finish('standard', picked.sort((a, b) => a - b));
    });
  }

  /* ---------- Flow ---------- */

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

    if (run !== this.run) return;
    this.taken = { code, shots, run };
    this.set({
      phase: 'select',
      shot: SHOTS,
      prompt: null,
      count: null,
      thumbs: shots.map((s) => this.deps.thumb(s)),
      selected: [],
      pkg: 'standard',
      upgradePending: false,
    });
    this.armSelectTimeout();
  }

  /** Chosen photos are final: roll the frame, reveal it, build and upload. */
  private async finish(pkg: PrintPackage, chosen: number[]): Promise<void> {
    const taken = this.taken;
    if (!taken || this.current.phase !== 'select') return;
    this.taken = null;
    const { code, shots, run } = taken;
    const signal = this.nextPhase();

    // Roll first: the frame is part of the print, so it has to be known before composing.
    const frame = roll(FRAMES, this.deps.random()).id;
    this.deps.log(`Gacha: frame ${frame} · ${pkg === 'big' ? 'versi besar' : 'strip'}`, 'ok');
    this.set({
      phase: 'reveal',
      frame,
      pkg,
      selected: chosen,
      upgradePending: false,
      thumbs: [], // big payload; not needed after this screen
      busy: true,
    });

    const minReveal = this.sleep(REVEAL_MS, signal).catch(() => {});
    const delivered = this.deps.deliver({ code, shots, chosen, pkg, frame }).catch((err: unknown) => {
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
    this.after(RESULT_MS, resultSignal, () => {
      this.deps.log('Layar hasil selesai — kembali ke layar awal');
      this.reset();
    });
  }
}
