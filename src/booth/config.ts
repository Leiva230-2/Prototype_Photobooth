/**
 * Print geometry.
 * 4x6" sheet at 300dpi = 1200 x 1800 px; one 2x6" strip = 600 x 1800 px.
 * Two identical strips per sheet — the printer cuts down the middle.
 */
export const SHEET_W = 1200;
export const SHEET_H = 1800;
export const STRIP_W = 600;
export const MARGIN_X = 36;
export const MARGIN_TOP = 36;
export const GAP = 18;
export const CELL_W = 528; // 3:2 photo cells
export const CELL_H = 352;
export const SHOTS = 4;
export const FOOTER_Y = MARGIN_TOP + SHOTS * CELL_H + (SHOTS - 1) * GAP; // 1498

/** 9:16 version, ready to post straight to a story. */
export const STORY_W = 1080;
export const STORY_H = 1920;

export const GIF_W = 480;
export const GIF_H = 320;
export const GIF_FRAME_MS = 420;

export const COUNTDOWN_FROM = 3;
export const PROMPT_MS = 2200;
export const AFTER_SHOT_MS = 600;

export const COLORS = {
  void: '#160F1E',
  paper: '#FAF6EF',
  cellBorder: '#E2DACE',
  dim: '#9E8FAD',
  flash: '#FF4D6D',
  mint: '#5BE0C8',
} as const;

export const FONT_FAMILY = '"Bricolage Grotesque", system-ui, sans-serif';

export interface Deck {
  label: string;
  prompts: readonly string[];
}

export const DECKS = {
  BESTIE: {
    label: 'Bestie',
    prompts: [
      'Pura-pura lagi ngegosipin orang di belakang kamera',
      'Muka pas dosen bilang "ada kuis hari ini"',
      'Peluk yang paling nggak nyaman',
      'Bebas — pose andalan kalian',
    ],
  },
  COUPLE: {
    label: 'Couple',
    prompts: [
      'Lihat satu sama lain kayak baru ketemu pertama kali',
      'Satu orang ngelucu, satu orang nahan ketawa',
      'Foto yang bakal kalian sesali 5 tahun lagi',
      'Bebas',
    ],
  },
  CHAOS: {
    label: 'Chaos',
    prompts: [
      'Ekspresi paling jelek yang kalian bisa',
      'Pura-pura lagi jatuh',
      'Semua orang lihat arah yang beda',
      'Bebas',
    ],
  },
  CORPORATE: {
    label: 'Corporate',
    prompts: [
      'Headshot LinkedIn paling serius',
      'Handshake yang terlalu formal',
      'Pura-pura lagi presentasi ke investor',
      'Bebas',
    ],
  },
  KULIAH: {
    label: 'Anak Kuliahan',
    prompts: [
      'Muka pas lihat nilai keluar',
      'Pura-pura baik-baik aja',
      'Sujud syukur karena akhirnya submit',
      'Bebas',
    ],
  },
} as const satisfies Record<string, Deck>;

export type DeckId = keyof typeof DECKS;

/** Session timing beyond the capture loop. */
export const DECK_TIMEOUT_MS = 60_000; // nobody picks a deck → back to the attract screen
export const REVEAL_MS = 3_400; // minimum time the gacha reveal stays on screen
export const RESULT_MS = 30_000; // result + QR screen, then back to attract
