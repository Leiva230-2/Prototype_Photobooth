import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DECKS, type DeckId } from '../booth/config';
import { FRAMES, frameById, odds } from '../booth/gacha';
import { hasCloud } from '../booth/settings';
import { GuestScreen, STAGE_H, STAGE_W } from '../guest/GuestScreen';
import { PHASE_LABELS, type GuestView, type Phase } from '../shared/view';
import { RoughFilter } from '../ui/Decor';
import { LiveVideo } from '../ui/LiveVideo';
import { ScaledStage } from '../ui/ScaledStage';
import type { BoothController, HostSnapshot } from './controller';

type Drawer = 'settings' | 'log' | null;
interface PanelProps {
  s: HostSnapshot;
  ctl: BoothController;
}

const PREVIEW_PHASES: Phase[] = ['idle', 'deck', 'capturing', 'select', 'reveal', 'result'];

function phaseText(v: GuestView): string {
  switch (v.phase) {
    case 'idle':
      return 'Siap — menunggu tamu';
    case 'deck':
      return 'Tamu sedang pilih gaya';
    case 'capturing':
      return `Foto ${Math.min(v.shot + 1, v.totalShots)}/${v.totalShots}${v.deck ? ` · ${DECKS[v.deck].label}` : ''}`;
    case 'select':
      return v.upgradePending
        ? 'Tamu minta versi besar — konfirmasi bayar'
        : `Tamu memilih foto (${v.selected.length}/${v.pickCount})`;
    case 'reveal':
      return v.busy ? 'Gacha + menyiapkan foto…' : 'Gacha';
    case 'result':
      return `Hasil · ${v.code ?? ''}`;
  }
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

export function App({ ctl }: { ctl: BoothController }) {
  const s = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot);
  const [drawer, setDrawer] = useState<Drawer>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, select, textarea')) return;
      if (e.key === 'Escape') {
        if (drawer) setDrawer(null);
        else ctl.reset();
      } else if (e.code === 'Space') {
        if (target.closest('button, a, summary')) return; // Space already "clicks" those
        e.preventDefault();
        ctl.start();
      } else if (e.key === 'f' || e.key === 'F') {
        void toggleFullscreen().catch(() => {});
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctl, drawer]);

  return (
    <div className="console">
      <RoughFilter />
      <CameraPanel s={s} ctl={ctl} />
      <aside className="console__side">
        <MirrorPanel s={s} ctl={ctl} />
        <ResultPanel s={s} ctl={ctl} />
      </aside>
      <StatusBar s={s} ctl={ctl} onOpen={setDrawer} />
      {drawer === 'settings' && (
        <DrawerShell title="Pengaturan" onClose={() => setDrawer(null)}>
          <SettingsForm s={s} ctl={ctl} />
        </DrawerShell>
      )}
      {drawer === 'log' && (
        <DrawerShell title="Log" onClose={() => setDrawer(null)}>
          <LogList s={s} ctl={ctl} />
        </DrawerShell>
      )}
    </div>
  );
}

/* ---------- Camera ---------- */
function CameraPanel({ s, ctl }: PanelProps) {
  const v = s.live;
  return (
    <section className="cam">
      <video
        ref={ctl.attachVideo}
        autoPlay
        playsInline
        muted
        className={s.settings.mirror ? 'is-mirrored' : undefined}
      />
      {s.cameraMessage && <div className="cam__message">{s.cameraMessage}</div>}
      {s.cameraInfo && <span className="cam__info">{s.cameraInfo}</span>}
      {v.phase === 'capturing' && v.prompt && <div className="cam__prompt">{v.prompt}</div>}
      {v.phase === 'capturing' && v.count !== null && (
        <div className="cam__count sticker" key={`${v.shot}-${v.count}`}>
          {v.count}
        </div>
      )}
    </section>
  );
}

/* ---------- Tablet mirror ---------- */
function MirrorPanel({ s, ctl }: PanelProps) {
  const connected = s.tablets > 0;
  const selected = s.designPhase ?? 'live';
  const locked = s.live.phase !== 'idle';
  return (
    <section className="panel mirror">
      <header className="panel__head">
        <h2>Layar tablet</h2>
        <span className={`conn ${connected ? 'is-on' : ''}`}>
          <i />
          {connected ? 'Tablet terhubung' : s.linkUp ? 'Tablet belum terhubung' : 'Server mati'}
        </span>
      </header>
      <div className="mirror__screen">
        <ScaledStage width={STAGE_W} height={STAGE_H}>
          <GuestScreen
            view={s.view}
            preview={<LiveVideo stream={s.stream} mirror={s.settings.mirror} />}
            onIntent={(intent) => ctl.intent(intent)}
          />
        </ScaledStage>
      </div>
      <div className="seg" role="group" aria-label="Lihat layar">
        <button type="button" aria-pressed={selected === 'live'} onClick={() => ctl.setDesignPhase(null)}>
          Live
        </button>
        {PREVIEW_PHASES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={selected === p}
            disabled={locked}
            onClick={() => ctl.setDesignPhase(p)}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>
      <p className="hint">
        {s.designPhase
          ? 'Mode pratinjau: tablet ikut menampilkan layar ini dengan data contoh. Klik lagi untuk replay animasi.'
          : 'Klik layar di atas sama seperti tap di tablet. Pilih layar lain untuk cek desainnya.'}
      </p>
    </section>
  );
}

/* ---------- Last result ---------- */
function ResultPanel({ s, ctl }: PanelProps) {
  const r = s.lastResult;
  return (
    <section className="panel result">
      <header className="panel__head">
        <h2>Hasil terakhir</h2>
        {r && <span className="code-tag">{r.code}</span>}
      </header>
      {!r ? (
        <p className="empty">Strip, frame dan QR dari sesi terakhir muncul di sini.</p>
      ) : (
        <div className="result__body">
          <a className="result__sheet" href={r.sheetUrl} target="_blank" rel="noopener">
            <img src={r.sheetUrl} alt={`Lembar cetak sesi ${r.code}`} />
          </a>
          <div className="result__info">
            <div className="result__chips">
              <FrameChip id={r.frame} />
              <span className={`pkg-chip ${r.pkg === 'big' ? 'is-big' : ''}`}>
                {r.pkg === 'big' ? 'Besar · 8 foto kecil × 2' : 'Strip · 4 foto'}
              </span>
            </div>
            {r.qr ? (
              <img className="result__qr" src={r.qr} alt="QR code galeri" />
            ) : (
              <p className="hint">QR tidak dibuat — cek Log.</p>
            )}
            <div className="result__actions">
              <button type="button" className="btn btn--small" onClick={() => ctl.redownloadSheet()}>
                Download ulang sheet
              </button>
              {r.link && (
                <a className="btn btn--small btn--ghost" href={r.link} target="_blank" rel="noopener">
                  Buka galeri
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FrameChip({ id }: { id: (typeof FRAMES)[number]['id'] }) {
  const f = frameById(id);
  return (
    <span className="frame-chip" style={{ background: f.bg, color: f.ink }}>
      Frame {f.name}
    </span>
  );
}

/* ---------- Status bar ---------- */
function StatusBar({ s, ctl, onOpen }: PanelProps & { onOpen(d: Drawer): void }) {
  const canStart = s.cameraReady && (s.live.phase === 'idle' || s.live.phase === 'deck');
  const errors = s.log.filter((e) => e.level === 'err').length;
  return (
    <footer className="bar">
      <span className="bar__brand sticker sticker--script" aria-label="Dearly">
        Dearly
      </span>
      <div className="bar__status">
        <span className={`conn ${s.tablets > 0 ? 'is-on' : ''}`}>
          <i />
          Tablet
        </span>
        <span className={`conn ${s.cameraReady ? 'is-on' : ''}`}>
          <i />
          Kamera
        </span>
        <span className={`conn ${hasCloud(s.settings) ? 'is-on' : 'is-warn'}`}>
          <i />
          {hasCloud(s.settings) ? 'Cloud' : 'Mode lokal'}
        </span>
        <strong className="bar__phase">{phaseText(s.live)}</strong>
        {s.designPhase && <span className="pill">Pratinjau</span>}
      </div>
      {s.live.phase === 'select' && (
        <div className={`bar__upgrade ${s.live.upgradePending ? 'is-pending' : ''}`}>
          <button type="button" className="btn btn--primary" onClick={() => ctl.approveUpgrade()}>
            {s.live.upgradePending ? 'Sudah bayar, cetak versi besar' : 'Upgrade ke versi besar'}
          </button>
          {s.live.upgradePending && (
            <button type="button" className="btn" onClick={() => ctl.declineUpgrade()}>
              Batal upgrade
            </button>
          )}
        </div>
      )}
      <label className="bar__deck">
        <span>Gaya default</span>
        <select value={s.settings.deck} onChange={(e) => ctl.updateSettings({ deck: e.target.value as DeckId })}>
          {(Object.keys(DECKS) as DeckId[]).map((id) => (
            <option key={id} value={id}>
              {DECKS[id].label}
            </option>
          ))}
        </select>
      </label>
      <div className="bar__actions">
        <button type="button" className="btn btn--primary" disabled={!canStart} onClick={() => ctl.start()}>
          {s.live.phase === 'deck' ? 'Foto pakai gaya default' : 'Mulai'} <kbd>Space</kbd>
        </button>
        <button type="button" className="btn" disabled={s.live.phase === 'idle'} onClick={() => ctl.reset()}>
          Reset <kbd>Esc</kbd>
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void toggleFullscreen().catch(() => {})}>
          Layar penuh <kbd>F</kbd>
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onOpen('settings')}>
          Pengaturan
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onOpen('log')}>
          Log {errors > 0 && <span className="badge">{errors}</span>}
        </button>
      </div>
    </footer>
  );
}

/* ---------- Drawers ---------- */
function DrawerShell({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer__panel" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2>{title}</h2>
          <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
            Tutup <kbd>Esc</kbd>
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </div>
    </div>
  );
}

function SettingsForm({ s, ctl }: PanelProps) {
  const set = ctl.updateSettings.bind(ctl);
  const pct = odds(FRAMES);
  return (
    <>
      <section>
        <h3>Kamera</h3>
        <select value={s.settings.cameraId} onChange={(e) => void ctl.selectCamera(e.target.value)}>
          {s.cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={s.settings.mirror} onChange={(e) => set({ mirror: e.target.checked })} />
          Mirror (preview dan hasil foto)
        </label>
        <p className="hint">
          iPhone: pasang dekat Mac, terkunci dan landscape, login Apple ID yang sama. Muncul sebagai “iPhone
          Camera”.
        </p>
      </section>

      <section>
        <h3>Strip</h3>
        <Field label="Nama event (dicetak di strip)">
          <input value={s.settings.eventName} onChange={(e) => set({ eventName: e.target.value })} />
        </Field>
      </section>

      <section>
        <h3>Cloud dan QR</h3>
        <Field label="Cloudinary cloud name">
          <input
            value={s.settings.cloudName}
            placeholder="kosongkan = simpan lokal"
            onChange={(e) => set({ cloudName: e.target.value.trim() })}
          />
        </Field>
        <Field label="Unsigned upload preset">
          <input
            value={s.settings.uploadPreset}
            placeholder="contoh: Prototype_Photo_Booth"
            onChange={(e) => set({ uploadPreset: e.target.value.trim() })}
          />
        </Field>
        <Field label="URL halaman galeri">
          <input
            type="url"
            value={s.settings.galleryUrl}
            placeholder="https://domainkamu.com/gallery.html"
            onChange={(e) => set({ galleryUrl: e.target.value.trim() })}
          />
        </Field>
        <p className="hint">QR code mengarah ke URL ini ditambah kode sesi, contoh ?s=7K9XPQ.</p>
      </section>

      <section>
        <h3>Gacha</h3>
        <ul className="odds">
          {FRAMES.map((f, i) => (
            <li key={f.id}>
              <span className="swatch" style={{ background: f.bg }} />
              {f.name}
              <span>{Math.round(pct[i])}%</span>
            </li>
          ))}
        </ul>
        <p className="hint">Ubah bobot di src/booth/gacha.ts.</p>
      </section>

      <section>
        <h3>Sambung tablet</h3>
        <ol className="steps">
          <li>Colok tablet ke Mac pakai kabel USB-C data.</li>
          <li>
            Jalankan <code>npm run tablet</code> di Terminal.
          </li>
          <li>
            Di Chrome tablet buka <code>localhost:5173/guest.html</code>.
          </li>
        </ol>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function LogList({ s, ctl }: PanelProps) {
  return (
    <>
      <div className="log" role="log">
        {s.log.length === 0 && <p className="empty">Belum ada aktivitas.</p>}
        {s.log.map((e) => (
          <div key={e.id} className={`log__row log__row--${e.level}`}>
            <time>{e.time}</time> {e.text}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn--small btn--ghost" onClick={() => ctl.clearLog()}>
        Bersihkan log
      </button>
    </>
  );
}
