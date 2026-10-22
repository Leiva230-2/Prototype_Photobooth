import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link } from '../shared/link';
import { IDLE_VIEW, type GuestView } from '../shared/view';
import { ScaledStage } from '../ui/ScaledStage';
import '../ui/stage.css';
import { GuestScreen, STAGE_H, STAGE_W } from './GuestScreen';
import './guest.css';

/** Keeps the tablet awake and fullscreen, and stops long-press menus. */
function useKioskMode(): void {
  useEffect(() => {
    const goFullscreen = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const noMenu = (e: Event) => e.preventDefault();
    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // Not supported or not allowed — the tablet's own screen timeout applies.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void keepAwake();
    };
    window.addEventListener('pointerdown', goFullscreen);
    window.addEventListener('contextmenu', noMenu);
    document.addEventListener('visibilitychange', onVisible);
    void keepAwake();
    return () => {
      window.removeEventListener('pointerdown', goFullscreen);
      window.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
}

function GuestApp() {
  const [view, setView] = useState<GuestView>(IDLE_VIEW);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [linkUp, setLinkUp] = useState(false);
  const [hosts, setHosts] = useState(0);
  const link = useRef<Link | null>(null);

  useEffect(() => {
    let current: string | null = null;
    const l = new Link('guest', {
      onStatus: (up) => {
        setLinkUp(up);
        if (!up) setHosts(0);
      },
      onMessage: (msg) => {
        if (msg.type === 'state') setView(msg.view);
        else if (msg.type === 'peers') setHosts(msg.hosts);
      },
      onFrame: (blob) => {
        const url = URL.createObjectURL(blob);
        const prev = current;
        current = url;
        setFrameUrl(url);
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000);
      },
    });
    link.current = l;
    return () => l.close();
  }, []);

  useKioskMode();

  const online = linkUp && hosts > 0;
  const preview = frameUrl ? <img src={frameUrl} alt="" /> : null;

  return (
    <ScaledStage width={STAGE_W} height={STAGE_H}>
      <GuestScreen
        view={view}
        preview={preview}
        onIntent={(intent) => link.current?.send({ type: 'intent', intent })}
      />
      {!online && (
        <div className="guest-offline gingham">
          <div className="guest-offline__card paper">
            <h1 className="sticker">Sebentar ya…</h1>
            <p>
              {linkUp
                ? 'Tablet sudah tersambung. Buka console booth di Mac (http://localhost:5173).'
                : 'Menghubungkan ke booth. Cek kabel USB, lalu jalankan “npm run tablet” di Mac.'}
            </p>
          </div>
        </div>
      )}
    </ScaledStage>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GuestApp />
  </StrictMode>,
);
