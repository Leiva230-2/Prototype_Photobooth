import { useRef, type CSSProperties, type ReactNode } from 'react';
import { DECKS, type DeckId } from '../booth/config';
import { FRAMES, frameById, odds, type FrameStyle } from '../booth/gacha';
import type { GuestIntent } from '../shared/link-protocol';
import type { GuestView } from '../shared/view';
import { useQr } from '../ui/useQr';
import './guest-screen.css';

/** Design size of the guest screen. The Galaxy Tab S8 in landscape is 1280×800 CSS px. */
export const STAGE_W = 1280;
export const STAGE_H = 800;

const DECK_ACCENTS: Record<DeckId, string> = {
  BESTIE: '#FF4D6D',
  COUPLE: '#FF9EB5',
  CHAOS: '#FFD166',
  CORPORATE: '#5BE0C8',
  KULIAH: '#B79CFF',
};

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
    <div className={`gs gs--${view.phase}`}>
      {view.phase === 'idle' && <Attract preview={preview} onStart={() => onIntent({ type: 'start' })} />}
      {view.phase === 'deck' && (
        <DeckPicker
          onPick={(deck) => onIntent({ type: 'deck', deck })}
          onCancel={() => onIntent({ type: 'cancel' })}
        />
      )}
      {view.phase === 'capturing' && <Capture view={view} preview={preview} />}
      {view.phase === 'reveal' && <Reveal view={view} />}
      {view.phase === 'result' && <Result view={view} onFinish={() => onIntent({ type: 'finish' })} />}
      {view.preview && <div className="gs-preview-tag">Pratinjau desain</div>}
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

/* ---------- Attract ---------- */
function Attract({ preview, onStart }: { preview: ReactNode; onStart(): void }) {
  const pct = odds(FRAMES);
  return (
    <div className="gs-attract" onClick={onStart}>
      <div className="gs-bleed">{preview}</div>
      <div className="gs-attract__shade" />
      <div className="gs-attract__copy">
        <p className="gs-kicker">Photobooth</p>
        <h1>
          Empat pose.
          <br />
          Satu frame misteri.
        </h1>
        <p className="gs-lede">Layar kasih arahan gaya tiap foto. Frame-nya diundi pas fotomu jadi.</p>
        <button type="button" className="gs-cta">
          Tap buat mulai
        </button>
      </div>
      <aside className="gs-odds">
        <p className="gs-odds__title">Frame yang bisa keluar</p>
        <ul>
          {FRAMES.map((f, i) => (
            <li key={f.id}>
              <MiniStrip frame={f} />
              <span className="gs-odds__name">{f.name}</span>
              <span className="gs-odds__pct">{Math.round(pct[i])}%</span>
            </li>
          ))}
        </ul>
        <p className="gs-odds__note">Peluang tiap frame sama.</p>
      </aside>
    </div>
  );
}

/* ---------- Deck picker ---------- */
function DeckPicker({ onPick, onCancel }: { onPick(deck: DeckId): void; onCancel(): void }) {
  return (
    <div className="gs-deck">
      <button type="button" className="gs-back" onClick={onCancel}>
        ← Batal
      </button>
      <header className="gs-deck__head">
        <h1>Mau gaya apa?</h1>
        <p>Pilih satu. Tiap foto nanti ada arahan pose-nya.</p>
      </header>
      <ul className="gs-deck__cards">
        {(Object.keys(DECKS) as DeckId[]).map((id, i) => (
          <li key={id}>
            <button
              type="button"
              className="gs-card"
              style={{ '--accent': DECK_ACCENTS[id], '--i': i } as CSSProperties}
              onClick={() => onPick(id)}
            >
              <span className="gs-card__label">{DECKS[id].label}</span>
              <span className="gs-card__teaser">“{DECKS[id].prompts[0]}”</span>
              <span className="gs-card__meta">4 pose →</span>
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
      <div className="gs-bleed">{preview}</div>
      <div className="gs-crop gs-crop--left" />
      <div className="gs-crop gs-crop--right" />
      {view.prompt && (
        <div className="gs-prompt">
          <span className="gs-prompt__step">
            Foto {Math.min(view.shot + 1, view.totalShots)} dari {view.totalShots}
          </span>
          <p key={view.shot}>{view.prompt}</p>
        </div>
      )}
      {view.count !== null && (
        <div className="gs-count" key={`${view.shot}-${view.count}`}>
          {view.count}
        </div>
      )}
      <div className="gs-pips">
        {Array.from({ length: view.totalShots }, (_, i) => (
          <span key={i} className={i < view.shot ? 'is-done' : i === view.shot ? 'is-now' : ''} />
        ))}
      </div>
      {flash !== null && <div className="gs-flash" key={flash} />}
    </div>
  );
}

/* ---------- Gacha reveal ---------- */
function Reveal({ view }: { view: GuestView }) {
  const frame = frameById(view.frame ?? 'putih');
  return (
    <div className="gs-reveal">
      <p className="gs-reveal__rolling">Lagi diundi…</p>
      <div className="gs-capsule" aria-hidden="true">
        <span className="gs-capsule__top" />
        <span className="gs-capsule__bottom" />
      </div>
      <div className="gs-reveal__prize">
        <MiniStrip frame={frame} className="gs-mini--prize" />
        <div className="gs-reveal__text">
          <p>Kamu dapet frame</p>
          <h1>
            <span className="gs-chip" style={frameVars(frame)}>
              {frame.name}
            </span>
          </h1>
        </div>
      </div>
      <p className="gs-reveal__status">{view.busy ? 'Lagi nyiapin foto kamu…' : 'Siap!'}</p>
    </div>
  );
}

/* ---------- Result ---------- */
function Result({ view, onFinish }: { view: GuestView; onFinish(): void }) {
  const frame = frameById(view.frame ?? 'putih');
  const qr = useQr(view.link);
  const code = view.code?.split('').join(' ') ?? '';
  return (
    <div className="gs-result">
      <div className="gs-result__strip">
        {view.stripThumb ? (
          <img src={view.stripThumb} alt="Strip foto kamu" />
        ) : (
          <MiniStrip frame={frame} className="gs-mini--result" />
        )}
      </div>
      <div className="gs-result__side">
        <p className="gs-kicker">
          Frame <span className="gs-chip gs-chip--small" style={frameVars(frame)}>{frame.name}</span>
        </p>
        <h1>Fotomu jadi!</h1>
        {view.link ? (
          <>
            <p className="gs-lede">Strip lagi dicetak. Scan QR ini buat simpan versi digitalnya.</p>
            <div className="gs-qr">{qr && <img src={qr} alt="QR code ke halaman foto kamu" />}</div>
          </>
        ) : (
          <>
            <p className="gs-lede">Strip lagi dicetak.</p>
            <div className="gs-note">{view.note ?? 'QR belum tersedia.'}</div>
          </>
        )}
        <p className="gs-code">
          Kode kamu <strong>{code}</strong>
        </p>
        <button type="button" className="gs-done" onClick={onFinish}>
          Selesai
        </button>
      </div>
    </div>
  );
}
