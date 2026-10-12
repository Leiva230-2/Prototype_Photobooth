import QRCode from 'qrcode';
import { Camera } from '../booth/camera';
import {
  buildGif,
  buildSheet,
  buildStory,
  buildStrip,
  ensureFonts,
  stripThumbnail,
  toJpeg,
} from '../booth/compose';
import type { DeckId } from '../booth/config';
import { frameById, secureRandom, type FrameId } from '../booth/gacha';
import { PreviewStream } from '../booth/preview-stream';
import { BoothSession, type DeliverInput, type DeliverResult } from '../booth/session';
import { hasCloud, loadSettings, saveSettings, type Settings } from '../booth/settings';
import { galleryLink, publicId, uploadUnsigned, type AssetKey } from '../shared/cloudinary';
import { Link } from '../shared/link';
import type { GuestIntent } from '../shared/link-protocol';
import { generateSessionCode } from '../shared/session-code';
import { IDLE_VIEW, sampleView, type GuestView, type Phase } from '../shared/view';

export type LogLevel = 'info' | 'ok' | 'err';
export interface LogEntry {
  id: number;
  time: string;
  text: string;
  level: LogLevel;
}

export interface LastResult {
  code: string;
  frame: FrameId;
  sheetUrl: string;
  gifUrl: string;
  link: string | null;
  qr: string | null;
}

export interface CameraOption {
  id: string;
  label: string;
}

export interface HostSnapshot {
  /** What the guest screen shows right now (live session or design preview). */
  view: GuestView;
  /** The real session, regardless of design preview. */
  live: GuestView;
  designPhase: Phase | null;
  settings: Settings;
  cameras: CameraOption[];
  cameraReady: boolean;
  cameraInfo: string | null;
  cameraMessage: string | null;
  stream: MediaStream | null;
  linkUp: boolean;
  tablets: number;
  consoles: number;
  lastResult: LastResult | null;
  log: LogEntry[];
}

const MAX_LOG = 200;

/**
 * Owns everything on the Mac side — camera, session, tablet link, upload —
 * and exposes one immutable snapshot for React (useSyncExternalStore).
 */
export class BoothController {
  private camera: Camera | null = null;
  private video: HTMLVideoElement | null = null;
  private preview: PreviewStream | null = null;
  private readonly link: Link;
  private readonly session: BoothSession<HTMLCanvasElement>;
  private readonly listeners = new Set<() => void>();
  private snapshot: HostSnapshot;
  private logId = 0;
  private lastSheet: { blob: Blob; code: string } | null = null;
  private objectUrls: string[] = [];

  constructor() {
    this.snapshot = {
      view: IDLE_VIEW,
      live: IDLE_VIEW,
      designPhase: null,
      settings: loadSettings(),
      cameras: [],
      cameraReady: false,
      cameraInfo: null,
      cameraMessage: 'Menyiapkan kamera…',
      stream: null,
      linkUp: false,
      tablets: 0,
      consoles: 0,
      lastResult: null,
      log: [],
    };

    this.session = new BoothSession<HTMLCanvasElement>(
      {
        grab: () => this.camera!.grab(this.snapshot.settings.mirror),
        deliver: (input) => this.deliver(input),
        newCode: generateSessionCode,
        random: secureRandom,
        log: (text, level) => this.log(text, level),
      },
      (live) => {
        this.patch({ live, ...(live.phase !== 'idle' ? { designPhase: null } : {}) });
        this.broadcast();
      },
    );

    this.link = new Link('host', {
      onStatus: (up) => {
        this.patch({ linkUp: up });
        if (up) this.broadcast();
        else this.patch({ tablets: 0 });
        this.updatePreview();
      },
      onMessage: (msg) => {
        if (msg.type === 'peers') {
          const joined = msg.guests > this.snapshot.tablets;
          if (msg.guests !== this.snapshot.tablets) {
            this.log(msg.guests > 0 ? 'Tablet terhubung' : 'Tablet terputus', msg.guests > 0 ? 'ok' : 'err');
          }
          if (msg.hosts > 1 && this.snapshot.consoles <= 1) {
            this.log('Console booth terbuka di lebih dari satu tab — tutup yang lain', 'err');
          }
          this.patch({ tablets: msg.guests, consoles: msg.hosts });
          if (joined) this.broadcast();
          this.updatePreview();
        } else if (msg.type === 'intent') {
          this.intent(msg.intent);
        }
      },
    });
  }

  /* ---------- React plumbing ---------- */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): HostSnapshot => this.snapshot;

  private patch(p: Partial<HostSnapshot>): void {
    const next = { ...this.snapshot, ...p };
    next.view = next.designPhase && next.live.phase === 'idle' ? sampleView(next.designPhase) : next.live;
    this.snapshot = next;
    this.listeners.forEach((fn) => fn());
  }

  private broadcast(): void {
    this.link.send({ type: 'state', view: this.snapshot.view });
  }

  log(text: string, level: LogLevel = 'info'): void {
    const entry: LogEntry = {
      id: ++this.logId,
      time: new Date().toLocaleTimeString('en-GB'),
      text,
      level,
    };
    this.patch({ log: [...this.snapshot.log, entry].slice(-MAX_LOG) });
  }

  clearLog(): void {
    this.patch({ log: [] });
  }

  /* ---------- Camera ---------- */
  /** Callback ref for the big camera <video> on the console. */
  attachVideo = (el: HTMLVideoElement | null): void => {
    if (!el || el === this.video) return;
    this.video = el;
    this.camera = new Camera(el);
    this.preview = new PreviewStream(
      el,
      (frame) => this.link.sendFrame(frame),
      () => this.link.backlog < 500_000,
    );
    this.preview.mirror = this.snapshot.settings.mirror;
    void this.initCamera();
  };

  private async initCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.patch({ cameraMessage: 'Browser ini tidak bisa akses kamera. Buka lewat http://localhost.' });
      this.log('getUserMedia tidak tersedia', 'err');
      return;
    }
    try {
      this.patch({ cameraMessage: 'Meminta izin kamera…' });
      await this.camera!.requestPermission();
      await this.refreshCameras();
      const saved = this.snapshot.settings.cameraId;
      const pick = this.snapshot.cameras.find((c) => c.id === saved)?.id ?? this.snapshot.cameras[0]?.id;
      await this.selectCamera(pick ?? '');
      navigator.mediaDevices.addEventListener('devicechange', () => void this.refreshCameras());
    } catch (err) {
      this.patch({ cameraMessage: 'Kamera tidak bisa dibuka. Cek izin kamera di browser.' });
      this.log(`Kamera diblokir: ${err instanceof Error ? err.message : String(err)}`, 'err');
    }
  }

  private async refreshCameras(): Promise<void> {
    if (!this.camera) return;
    const list = await this.camera.list();
    this.patch({ cameras: list.map((c, i) => ({ id: c.deviceId, label: c.label || `Kamera ${i + 1}` })) });
  }

  async selectCamera(deviceId: string): Promise<void> {
    if (!this.camera) return;
    this.patch({ cameraReady: false, cameraMessage: 'Membuka kamera…' });
    try {
      const { width, height } = await this.camera.open(deviceId || undefined);
      const label = this.snapshot.cameras.find((c) => c.id === this.camera!.activeDeviceId)?.label ?? 'Kamera';
      this.updateSettings({ cameraId: this.camera.activeDeviceId ?? deviceId });
      this.patch({
        cameraReady: true,
        cameraMessage: null,
        cameraInfo: `${label} · ${width}×${height}`,
        stream: this.camera.mediaStream,
      });
      this.log(`Kamera aktif: ${width}×${height}`, 'ok');
      this.updatePreview();
    } catch (err) {
      this.patch({ cameraMessage: 'Kamera ini tidak bisa dibuka. Coba pilih kamera lain.' });
      this.log(`Gagal membuka kamera: ${err instanceof Error ? err.message : String(err)}`, 'err');
    }
  }

  private updatePreview(): void {
    if (!this.preview) return;
    const want = this.snapshot.linkUp && this.snapshot.tablets > 0 && this.snapshot.cameraReady;
    if (want && !this.preview.running) this.preview.start();
    if (!want && this.preview.running) this.preview.stop();
  }

  /* ---------- Settings ---------- */
  updateSettings(p: Partial<Settings>): void {
    const settings = { ...this.snapshot.settings, ...p };
    saveSettings(settings);
    if (this.preview) this.preview.mirror = settings.mirror;
    this.patch({ settings });
  }

  /* ---------- Session controls ---------- */
  get defaultDeck(): DeckId {
    return this.snapshot.settings.deck;
  }

  /** Space / Mulai button on the Mac. */
  start(): void {
    if (!this.snapshot.cameraReady) {
      this.log('Kamera belum siap', 'err');
      return;
    }
    this.session.quickStart(this.defaultDeck);
  }

  reset(): void {
    this.session.reset();
  }

  /** Taps from the tablet, or clicks on the mirror. */
  intent(intent: GuestIntent): void {
    if (this.snapshot.view.preview) return; // design preview is look-only
    if (intent.type === 'start' && !this.snapshot.cameraReady) {
      this.log('Tablet minta mulai, tapi kamera belum siap', 'err');
      return;
    }
    this.session.handleIntent(intent, this.defaultDeck);
  }

  /** Shows a guest screen with sample data on the mirror and the tablet. */
  setDesignPhase(phase: Phase | null): void {
    if (phase && this.snapshot.live.phase !== 'idle') return;
    if (phase && phase === this.snapshot.designPhase) {
      // Same screen clicked again: blank it for a moment so its animation replays.
      this.patch({ designPhase: null });
      this.broadcast();
      setTimeout(() => this.setDesignPhase(phase), 80);
      return;
    }
    this.patch({ designPhase: phase });
    this.broadcast();
  }

  redownloadSheet(): void {
    if (this.lastSheet) download(this.lastSheet.blob, `sheet-${this.lastSheet.code}.jpg`);
  }

  /* ---------- Delivery ---------- */
  private async deliver({ code, shots, frame }: DeliverInput<HTMLCanvasElement>): Promise<DeliverResult> {
    const settings = this.snapshot.settings;
    const style = frameById(frame);
    await ensureFonts();
    const strip = buildStrip(shots, { code, eventName: settings.eventName, date: new Date() }, style);
    const [sheetBlob, storyBlob] = await Promise.all([
      toJpeg(buildSheet(strip)),
      toJpeg(buildStory(strip, style)),
    ]);
    const gifBlob = buildGif(shots);
    const stripThumb = stripThumbnail(strip);
    const kb = (b: Blob) => `${Math.round(b.size / 1024)}KB`;
    this.log(`Dibuat: sheet ${kb(sheetBlob)} · story ${kb(storyBlob)} · gif ${kb(gifBlob)}`);

    this.objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const sheetUrl = this.objectUrl(sheetBlob);
    const gifUrl = this.objectUrl(gifBlob);
    this.lastSheet = { blob: sheetBlob, code };
    this.patch({ lastResult: { code, frame, sheetUrl, gifUrl, link: null, qr: null } });

    // The print sheet always lands on this Mac for the printer, on top of any cloud copy.
    download(sheetBlob, `sheet-${code}.jpg`);
    this.log(`Download sheet-${code}.jpg`);

    const jobs: [AssetKey, string, Blob, string][] = [
      ['sheet', 'Sheet', sheetBlob, `sheet-${code}.jpg`],
      ['story', 'Story', storyBlob, `story-${code}.jpg`],
      ['gif', 'GIF', gifBlob, `anim-${code}.gif`],
    ];

    if (!hasCloud(settings)) {
      this.log('Cloud belum diatur — story & GIF di-download lokal', 'err');
      for (const [key, , blob, filename] of jobs) if (key !== 'sheet') download(blob, filename);
      return { link: null, stripThumb };
    }

    const outcomes = await Promise.allSettled(
      jobs.map(([key, , blob]) =>
        uploadUnsigned(settings.cloudName, settings.uploadPreset, blob, publicId(code, key)),
      ),
    );
    let allUploaded = true;
    outcomes.forEach((o, i) => {
      const [key, label, blob, filename] = jobs[i];
      if (o.status === 'fulfilled') {
        this.log(`Upload ${label} berhasil`, 'ok');
        return;
      }
      allUploaded = false;
      this.log(`Upload ${label} gagal — ${(o.reason as Error).message}`, 'err');
      if (key !== 'sheet') download(blob, filename);
    });
    if (!allUploaded) return { link: null, stripThumb };

    if (!settings.galleryUrl) {
      this.log('Upload berhasil, tapi URL galeri kosong — QR tidak dibuat', 'err');
      return { link: null, stripThumb };
    }
    let link: string;
    try {
      link = galleryLink(settings.galleryUrl, code);
    } catch {
      this.log(`URL galeri tidak valid: ${settings.galleryUrl}`, 'err');
      return { link: null, stripThumb };
    }
    const qr = await QRCode.toDataURL(link, { margin: 1, width: 360 });
    this.patch({ lastResult: { code, frame, sheetUrl, gifUrl, link, qr } });
    return { link, stripThumb };
  }

  private objectUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    return url;
  }
}

function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
