import { useRef, type CSSProperties, type ReactNode } from 'react';
import { DECKS, type DeckId } from '../booth/config';
import { FRAMES, frameById, odds, type FrameStyle } from '../booth/gacha';
import type { GuestIntent } from '../shared/link-protocol';
import type { GuestView } from '../shared/view';
import { Burst, Confetti, RoughFilter, Star } from '../ui/Decor';
import { useQr } from '../ui/useQr';
import '../ui/brand.css';
import './guest-screen.css';

/** Design size of the guest screen. The Galaxy Tab S8 in landscape is 1280×800 CSS px. */
export const STAGE_W = 1280;
export const STAGE_H = 800;

interface Props {
  view: GuestView;
  /** Live camera picture: a <video> on the Mac, an <img> stream on the tablet. */
  preview: ReactNode;
  onIntent(intent: GuestIntent): void;
}

/**
 * The whole guest-facing screen. Pure: it only draws `view` and reports taps,
 * so the tablet and the Mac mirror render exactly the same thing.
 */
export function GuestScreen({ view, preview, onIntent }: Props) {
  return (
    <div className={`gs ${view.phase === 'idle' ? 'sky-bg' : 'gingham'} gs--${view.phase}`}>
      <RoughFilter />
      {view.phase === 'idle' && <Attract preview={preview} onStart={() => onIntent({ type: 'start' })} />}
      {view.phase === 'deck' && (
        <DeckPicker
          onPick={(deck) => onIntent({ type: 'deck', deck })}
          onCancel={() => onIntent({ type: 'cancel' })}
        />
      )}
      {view.phase === 'capturing' && <Capture view={view} preview={preview} />}
      {view.phase === 'select' && <Select view={view} onIntent={onIntent} />}
      {view.phase === 'reveal' && <Reveal view={view} />}
      {view.phase === 'result' && <Result view={view} onFinish={() => onIntent({ type: 'finish' })} />}
      {view.preview && <div className="gs-preview-note sticky">Pratinjau desain</div>}
    </div>
  );
}

function frameVars(frame: FrameStyle): CSSProperties {
  return { '--f-bg': frame.bg, '--f-border': frame.border, '--f-ink': frame.ink } as CSSProperties;
}

/** Tiny strip with four photo holes, painted in a frame's colours. */
function MiniStrip({ frame, className = '' }: { frame: FrameStyle; className?: string }) {
  return (
    <span className={`gs-mini ${className}`} style={frameVars(frame)} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** "Dearly" over "Photobooth", as on the title slide. */
function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`gs-logo ${className}`} role="img" aria-label="Dearly Photobooth">
      <span className="gs-logo__script sticker sticker--script">Dearly</span>
      <span className="gs-logo__word sticker">Photobooth</span>
    </div>
  );
}

/* ---------- Attract ---------- */
function Attract({ preview, onStart }: { preview: ReactNode; onStart(): void }) {
  const pct = odds(FRAMES);
  return (
    <div className="gs-attract" onClick={onStart}>
      <Confetti />
      <Burst size={150} className="gs-attract__burst" />
      <Star size={42} className="gs-attract__star1" />
      <Star size={30} className="gs-attract__star2" />
      <Star size={54} className="gs-attract__star3" />

      <div className="gs-attract__left">
        <Logo />
        <p className="gs-attract__lede paper">Ikutin arahan pose di layar. Frame-nya? Diundi.</p>
        <button type="button" className="gs-attract__cta tag">
          Tap buat mulai
        </button>
      </div>

      <div className="gs-attract__photo">
        <div className="gs-attract__shadow">
          <div className="stamp">
            <div className="gs-attract__live">{preview}</div>
          </div>
        </div>
        <span className="gs-attract__you tag">Ini kamu!</span>
      </div>

      <aside className="gs-odds sticky">
        <p className="gs-odds__title">Frame yang bisa keluar</p>
        <ul>
          {FRAMES.map((f, i) => (
            <li key={f.id}>
              <MiniStrip frame={f} />
              <span>
                <b>{f.name}</b>
                {Math.round(pct[i])}%
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/* ---------- Deck picker ---------- */
/** Poses previewed on each card; the rest are a surprise. */
const CARD_POSES = 3;

function DeckPicker({ onPick, onCancel }: { onPick(deck: DeckId): void; onCancel(): void }) {
  return (
    <div className="gs-sheet paper gs-deck">
      <Star size={46} className="gs-deck__star1" />
      <Star size={30} className="gs-deck__star2" />
      <button type="button" className="gs-back" onClick={onCancel}>
        Batal
      </button>
      <h1 className="gs-title sticker">Mau gaya apa?</h1>
      <p className="gs-deck__sub">Pilih satu, nanti tiap foto ada arahan pose-nya.</p>
      <ul className="gs-deck__cards">
        {(Object.keys(DECKS) as DeckId[]).map((id) => (
          <li key={id}>
            <button type="button" className="gs-card" onClick={() => onPick(id)}>
              <span className="gs-card__label">{DECKS[id].label}</span>
              {/* Spans, not a list: buttons may only contain inline content. */}
              <span className="gs-card__poses">
                {DECKS[id].prompts.slice(0, CARD_POSES).map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </span>
              <span className="gs-card__more">+{DECKS[id].prompts.length - CARD_POSES} pose lagi</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Capture ---------- */
/** Flash only for shots taken after this screen appeared (not on first render). */
function useNewFlash(flashId: number): number | null {
  const first = useRef(flashId);
  return flashId !== first.current ? flashId : null;
}

function Capture({ view, preview }: { view: GuestView; preview: ReactNode }) {
  const flash = useNewFlash(view.flashId);
  return (
    <div className="gs-capture">
      {/* The window is exactly 3:2 — the shape of each photo on the strip. */}
      <div className="gs-capture__window">
        <div className="gs-capture__live">{preview}</div>
        {/* What the small portrait photos of the big print keep (centre crop). */}
        <div className="gs-capture__guide" aria-hidden="true">
          <span>Area foto kecil</span>
        </div>
        {view.count !== null && (
          <div className="gs-count sticker" key={`${view.shot}-${view.count}`}>
            {view.count}
          </div>
        )}
        {flash !== null && <div className="gs-flash" key={flash} />}
      </div>
      {view.prompt && (
        <div className="gs-prompt" key={view.shot}>
          <span className="gs-prompt__step sticky">
            Foto {Math.min(view.shot + 1, view.totalShots)} dari {view.totalShots}
          </span>
          <p className="tag">{view.prompt}</p>
        </div>
      )}
      <div className="gs-progress paper" aria-label={`Foto ${Math.min(view.shot + 1, view.totalShots)} dari ${view.totalShots}`}>
        {Array.from({ length: view.totalShots }, (_, i) => (
          <Star key={i} size={24} className={i < view.shot ? 'is-done' : i === view.shot ? 'is-now' : ''} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Pick photos ---------- */
function Select({ view, onIntent }: { view: GuestView; onIntent(intent: GuestIntent): void }) {
  const count = view.selected.length;
  const full = count >= view.pickCount;
  const tiles = Array.from({ length: view.totalShots }, (_, i) => i);
  return (
    <div className="gs-sheet paper gs-select">
      <Star size={40} className="gs-select__star" />
      <h1 className="gs-title sticker">Pilih {view.pickCount} foto favoritmu</h1>
      <p className="gs-select__sub">Tap fotonya. Yang kamu pilih masuk ke strip.</p>

      <ul className="gs-select__grid">
        {tiles.map((i) => {
          const on = view.selected.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                className={`gs-tile ${on ? 'is-on' : ''} ${full && !on ? 'is-muted' : ''}`}
                aria-pressed={on}
                aria-label={`Foto ${i + 1}`}
                onClick={() => onIntent({ type: 'toggle', index: i })}
              >
                {view.thumbs[i] ? (
                  <img src={view.thumbs[i]} alt="" />
                ) : (
                  <span className={`gs-tile__blank gs-tile__blank--${i % 3}`} />
                )}
                <span className="gs-tile__no">{i + 1}</span>
                {on && (
                  <span className="gs-tile__check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="26" height="26">
                      <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="gs-select__bar">
        <button type="button" className="gs-upsell sticky" onClick={() => onIntent({ type: 'upgrade' })}>
          <b>Suka semua?</b>
          <span>Ambil versi besar: semua {view.totalShots} foto, dicetak 2 set</span>
        </button>
        <div className="gs-select__go">
          <span className="gs-select__count">
            {count} dari {view.pickCount} dipilih
          </span>
          <button
            type="button"
            className="gs-next"
            aria-disabled={!full}
            onClick={() => full && onIntent({ type: 'confirm' })}
          >
            Lanjut
          </button>
        </div>
      </div>

      {view.upgradePending && (
        <div className="gs-pending">
          <div className="gs-pending__card paper">
            <Star size={44} className="gs-pending__star" />
            <h2 className="sticker">Versi besar!</h2>
            <p>
              Semua {view.totalShots} foto dicetak ukuran kecil, 2 set: buat kamu dan temanmu. Bayar ke kasir
              dulu ya, setelah dikonfirmasi langsung lanjut.
            </p>
            <button type="button" className="gs-pending__back" onClick={() => onIntent({ type: 'cancelUpgrade' })}>
              Nggak jadi, pilih {view.pickCount} aja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Gacha reveal ---------- */
function Reveal({ view }: { view: GuestView }) {
  const frame = frameById(view.frame ?? 'putih');
  return (
    <div className="gs-reveal">
      <Burst size={220} className="gs-reveal__burst1" />
      <Burst size={140} className="gs-reveal__burst2" />
      <p className="gs-reveal__rolling sticker sticker--script">Lagi diundi…</p>
      <div className="gs-capsule" aria-hidden="true">
        <span className="gs-capsule__top" />
        <span className="gs-capsule__bottom" />
      </div>
      <div className="gs-reveal__prize">
        <MiniStrip frame={frame} className="gs-mini--prize" />
        <div className="gs-reveal__text">
          <p className="sticker sticker--script">Kamu dapet frame</p>
          <h1 className="gs-reveal__name sticker" style={frameVars(frame)}>
            {frame.name}
          </h1>
        </div>
      </div>
      <p className="gs-reveal__status paper">{view.busy ? 'Lagi nyiapin fotomu…' : 'Siap!'}</p>
    </div>
  );
}

/* ---------- Result ---------- */
function Result({ view, onFinish }: { view: GuestView; onFinish(): void }) {
  const frame = frameById(view.frame ?? 'putih');
  const qr = useQr(view.link);
  const printing = view.pkg === 'big' ? 'Versi besarmu lagi dicetak.' : 'Strip-nya lagi dicetak.';
  return (
    <div className={`gs-result ${view.pkg === 'big' ? 'gs-result--big' : ''}`}>
      <div className="gs-result__strip">
        <span className="tape gs-result__tape1" />
        {view.stripThumb ? (
          <img src={view.stripThumb} alt="Strip foto kamu" />
        ) : (
          <MiniStrip frame={frame} className="gs-mini--result" />
        )}
        <span className="tape gs-result__tape2" />
        <Star size={58} className="gs-result__star" />
      </div>

      <div className="gs-sheet paper gs-result__card">
        <h1 className="gs-title sticker">Fotomu jadi!</h1>
        {view.link ? (
          <p className="gs-result__copy">
            {printing} Scan QR ini buat simpan semua {view.totalShots} foto versi digitalnya.
          </p>
        ) : (
          <p className="gs-result__copy">
            {printing} {view.note ?? 'QR belum tersedia.'}
          </p>
        )}
        <div className="gs-result__row">
          {view.link && (
            <div className="gs-result__qr">
              <div className="stamp">{qr ? <img src={qr} alt="QR code ke halaman foto kamu" /> : <span />}</div>
            </div>
          )}
          <div className="gs-result__meta">
            <span className="gs-result__label">Kode kamu</span>
            <span className="tag gs-result__code">{view.code}</span>
            <span className="gs-result__label">Frame</span>
            <span className="gs-result__frame" style={frameVars(frame)}>
              {frame.name}
            </span>
          </div>
        </div>
        <button type="button" className="gs-done" onClick={onFinish}>
          Selesai
        </button>
      </div>
    </div>
  );
}
