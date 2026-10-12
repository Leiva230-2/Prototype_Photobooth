import { DECKS, SHOTS, type DeckId } from '../booth/config';
import type { FrameId } from '../booth/gacha';

/**
 * Everything the guest screen needs to draw itself. The Mac sends this to the
 * tablet on every change, and renders the same thing in its tablet mirror.
 */
export type Phase = 'idle' | 'deck' | 'capturing' | 'reveal' | 'result';

export interface GuestView {
  phase: Phase;
  deck: DeckId | null;
  /** Index of the current shot (0-based) while capturing. */
  shot: number;
  totalShots: number;
  prompt: string | null;
  /** Countdown number, or null between countdowns. */
  count: number | null;
  /** Increments on every shot so screens can replay the flash. */
  flashId: number;
  frame: FrameId | null;
  code: string | null;
  /** Gallery link for the QR code. */
  link: string | null;
  /** Small JPEG data URL of the finished strip. */
  stripThumb: string | null;
  /** True while the strip is still being built and uploaded. */
  busy: boolean;
  /** Short note for the guest, e.g. when the QR isn't available. */
  note: string | null;
  /** True when the operator is previewing a screen with sample data. */
  preview: boolean;
}

export const IDLE_VIEW: GuestView = {
  phase: 'idle',
  deck: null,
  shot: 0,
  totalShots: SHOTS,
  prompt: null,
  count: null,
  flashId: 0,
  frame: null,
  code: null,
  link: null,
  stripThumb: null,
  busy: false,
  note: null,
  preview: false,
};

export const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Layar awal',
  deck: 'Pilih gaya',
  capturing: 'Foto',
  reveal: 'Gacha',
  result: 'Hasil + QR',
};

/** Sample data so every screen can be previewed without running a session. */
export function sampleView(phase: Phase): GuestView {
  const deck: DeckId = 'BESTIE';
  return {
    ...IDLE_VIEW,
    phase,
    preview: true,
    deck: phase === 'idle' ? null : deck,
    shot: phase === 'capturing' ? 1 : 0,
    prompt: phase === 'capturing' ? DECKS[deck].prompts[1] : null,
    count: phase === 'capturing' ? 3 : null,
    frame: phase === 'reveal' || phase === 'result' ? 'ungu' : null,
    code: phase === 'result' ? 'K7XP2Q' : null,
    link: phase === 'result' ? 'https://example.com/gallery.html?s=K7XP2Q' : null,
  };
}
