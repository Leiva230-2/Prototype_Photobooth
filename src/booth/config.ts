/**
 * Print geometry.
 * 4x6" sheet at 300dpi = 1200 x 1800 px; one 2x6" strip = 600 x 1800 px.
 * Two identical strips per sheet — the printer cuts down the middle.
 */
export const SHEET_W = 1200;
export const SHEET_H = 1800;
export const STRIP_W = 600;
// Matches the designers' frame template (frame PNGs with transparent photo holes).
export const MARGIN_X = 40;
export const MARGIN_TOP = 43;
export const GAP = 37;
export const CELL_W = 520;
export const CELL_H = 340;
/** Photos taken per session. */
export const SHOTS = 8;
/** Photos the guest picks for the strip. */
export const STRIP_SHOTS = 4;
export const FOOTER_Y = MARGIN_TOP + STRIP_SHOTS * CELL_H + (STRIP_SHOTS - 1) * GAP; // 1514

/**
 * Big print: 16 landscape cells of 3.5 × 2.55 cm (414 × 300 px), edge to edge.
 * It is laid out on a landscape 6x4" canvas (1800 × 1200) as two identical
 * halves, top and bottom: 4 columns × 2 rows of the 8 photos each, with the
 * logo and code in a narrow footer on the right. For printing the canvas is
 * turned 90°, so the printer's 2x6 cut runs between the two halves.
 */
export const BIG_W = 1800;
export const BIG_H = 1200;
export const BIG_COLS = 4;
export const BIG_ROWS = 2; // per half
export const BIG_CELL_W = 414;
export const BIG_CELL_H = 300;
export const BIG_FOOTER_X = BIG_COLS * BIG_CELL_W; // 1656

/**
 * Digital "all photos" sheet (every guest gets it): 8 landscape photos,
 * 2 columns × 4 rows, nothing cropped to portrait.
 */
export const ALL_COLS = 2;
export const ALL_MARGIN = 36;
export const ALL_GAP = 18;
export const ALL_CELL_W = 555;
export const ALL_CELL_H = 370;
export const ALL_FOOTER_Y = ALL_MARGIN + 4 * ALL_CELL_H + 3 * ALL_GAP; // 1570

/** 9:16 version, ready to post straight to a story. */
export const STORY_W = 1080;
export const STORY_H = 1920;

export const GIF_W = 480;
export const GIF_H = 320;
export const GIF_FRAME_MS = 420;

export const COUNTDOWN_FROM = 3;
// Shorter than before so 8 shots still fit in about 42 seconds.
export const PROMPT_MS = 1800;
export const AFTER_SHOT_MS = 500;

/** Dearly brand colours (from the Venture Creation deck), for canvas drawing. */
export const COLORS = {
  red: '#9E2A2B',
  cream: '#EFE8DF',
  sky: '#D6E2F3',
  check: 'rgba(84, 127, 204, 0.44)',
  shadow: 'rgba(34, 52, 92, 0.35)',
} as const;

/** Bundled fonts (see src/ui/brand.css). Canvas needs them loaded first: see ensureFonts(). */
export const FONTS = {
  body: '"Nunito Variable", "Nunito", system-ui, sans-serif',
  chunky: '"Titan One", system-ui, sans-serif',
  script: '"Damion", cursive',
} as const;

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
      'Saling tunjuk: "dia yang salah!"',
      'Pura-pura nggak kenal satu sama lain',
      'Tos paling heboh',
      'Foto ala album keluarga zaman dulu',
      'Bebas — pose andalan kalian',
    ],
  },
  COUPLE: {
    label: 'Couple',
    prompts: [
      'Lihat satu sama lain kayak baru ketemu pertama kali',
      'Satu orang ngelucu, satu orang nahan ketawa',
      'Foto yang bakal kalian sesali 5 tahun lagi',
      'Pura-pura berantem soal mau makan di mana',
      'Pose prewedding paling dramatis',
      'Bisikin sesuatu ke telinga pasangan',
      'Bikin bentuk hati pakai tangan berdua',
      'Bebas',
    ],
  },
  CHAOS: {
    label: 'Chaos',
    prompts: [
      'Ekspresi paling jelek yang kalian bisa',
      'Pura-pura lagi jatuh',
      'Semua orang lihat arah yang beda',
      'Pura-pura kesetrum',
      'Teriak sekencang-kencangnya, tapi tanpa suara',
      'Jadi patung paling aneh',
      'Satu orang pingsan, sisanya panik',
      'Bebas',
    ],
  },
  CORPORATE: {
    label: 'Corporate',
    prompts: [
      'Headshot LinkedIn paling serius',
      'Handshake yang terlalu formal',
      'Pura-pura lagi presentasi ke investor',
      'Tunjuk grafik yang nggak ada',
      'Muka "meeting ini harusnya cukup lewat email"',
      'Foto tim buat website kantor',
      'Rayain closing deal',
      'Bebas',
    ],
  },
  KULIAH: {
    label: 'Anak Kuliahan',
    prompts: [
      'Muka pas lihat nilai keluar',
      'Pura-pura baik-baik aja',
      'Sujud syukur karena akhirnya submit',
      'Ngantuk di kelas jam 7 pagi',
      'Nunggu dosen yang nggak dateng-dateng',
      'Panik, deadline jam 23.59',
      'Lempar toga khayalan',
      'Bebas',
    ],
  },
} as const satisfies Record<string, Deck>;

export type DeckId = keyof typeof DECKS;

/** Session timing beyond the capture loop. */
export const DECK_TIMEOUT_MS = 60_000; // nobody picks a deck → back to the attract screen
export const SELECT_TIMEOUT_MS = 45_000; // nobody picks → the first photos are used
export const REVEAL_MS = 3_400; // minimum time the gacha reveal stays on screen
export const RESULT_MS = 30_000; // result + QR screen, then back to attract
