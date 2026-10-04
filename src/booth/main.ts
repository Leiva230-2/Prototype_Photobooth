import QRCode from 'qrcode';
import '../styles/booth.css';
import { galleryLink, publicId, uploadUnsigned, type AssetKey } from '../shared/cloudinary';
import { generateSessionCode } from '../shared/session-code';
import { Camera } from './camera';
import { buildGif, buildSheet, buildStory, buildStrip, ensureFonts, toJpeg } from './compose';
import { AFTER_SHOT_MS, COUNTDOWN_FROM, DECKS, PROMPT_MS, SHOTS, type DeckId } from './config';
import { createLogger } from './logger';
import { hasCloud, loadSettings, saveSettings, type Settings } from './settings';

/* ---------- DOM ---------- */
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const video = $<HTMLVideoElement>('video');
const viewfinder = $('viewfinder');
const vfMessage = $('vfMessage');
const promptEl = $('prompt');
const countEl = $('count');
const pipsEl = $('pips');
const flashEl = $('flash');
const guestQr = $('guestQr');
const guestQrImg = $<HTMLImageElement>('guestQrImg');
const guestQrCode = $('guestQrCode');

const startBtn = $<HTMLButtonElement>('startBtn');
const resetBtn = $<HTMLButtonElement>('resetBtn');
const deckSel = $<HTMLSelectElement>('deckSel');
const mirrorChk = $<HTMLInputElement>('mirrorChk');
const fullscreenBtn = $<HTMLButtonElement>('fullscreenBtn');
const camSel = $<HTMLSelectElement>('camSel');
const cloudStatus = $('cloudStatus');

const inputs = {
  eventName: $<HTMLInputElement>('eventName'),
  cloudName: $<HTMLInputElement>('cloudName'),
  uploadPreset: $<HTMLInputElement>('preset'),
  galleryUrl: $<HTMLInputElement>('galleryUrl'),
} as const;

const results = $('results');
const resultCode = $('resultCode');
const sheetImg = $<HTMLImageElement>('sheetImg');
const gifImg = $<HTMLImageElement>('gifImg');
const sheetLink = $<HTMLAnchorElement>('sheetLink');
const gifLink = $<HTMLAnchorElement>('gifLink');
const redownloadBtn = $<HTMLButtonElement>('redownloadBtn');
const linksEl = $('links');

const log = createLogger($('log'));
const camera = new Camera(video);

/* ---------- State ---------- */
let settings: Settings = loadSettings();
let busy = false;
let abort: AbortController | null = null;
let lastSheet: { blob: Blob; code: string } | null = null;
const objectUrls: string[] = [];

/* ---------- Helpers ---------- */
class Cancelled extends Error {}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Cancelled());
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Cancelled());
      },
      { once: true },
    );
  });
}

function restartAnimation(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation replays
  el.classList.add(cls);
}

function objectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function revokeObjectUrls(): void {
  objectUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
}

function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function addLink(label: string, url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = `${label} → ${url}`;
  linksEl.append(a);
}

function showMessage(text: string | null): void {
  vfMessage.hidden = !text;
  vfMessage.textContent = text ?? '';
}

function renderPips(done: number): void {
  pipsEl.replaceChildren(
    ...Array.from({ length: SHOTS }, (_, i) => {
      const p = document.createElement('span');
      p.className = i < done ? 'pip is-done' : 'pip';
      return p;
    }),
  );
}

/* ---------- Settings UI ---------- */
function renderCloudStatus(): void {
  const cloud = hasCloud(settings);
  cloudStatus.textContent = cloud ? 'Cloud aktif' : 'Mode lokal';
  cloudStatus.dataset.state = cloud ? 'ok' : 'local';
}

function bindSettings(): void {
  deckSel.replaceChildren(
    ...Object.entries(DECKS).map(([id, deck]) => new Option(`Deck: ${deck.label}`, id)),
  );
  deckSel.value = settings.deck;
  mirrorChk.checked = settings.mirror;
  video.classList.toggle('is-mirrored', settings.mirror);

  for (const [key, input] of Object.entries(inputs) as [keyof typeof inputs, HTMLInputElement][]) {
    input.value = settings[key];
    input.addEventListener('input', () => update({ [key]: input.value.trim() }));
  }
  deckSel.addEventListener('change', () => update({ deck: deckSel.value as DeckId }));
  mirrorChk.addEventListener('change', () => {
    update({ mirror: mirrorChk.checked });
    video.classList.toggle('is-mirrored', mirrorChk.checked);
  });

  // First run without cloud config: open the settings so the operator sees them.
  if (!hasCloud(settings)) ($('settings') as HTMLDetailsElement).open = true;
  renderCloudStatus();
}

function update(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  renderCloudStatus();
}

/* ---------- Camera ---------- */
async function refreshCameraList(): Promise<void> {
  const cams = await camera.list();
  const selected = camera.activeDeviceId ?? settings.cameraId;
  camSel.replaceChildren(
    ...cams.map((c, i) => new Option(c.label || `Kamera ${i + 1}`, c.deviceId)),
  );
  if (cams.some((c) => c.deviceId === selected)) camSel.value = selected;
  log(`${cams.length} kamera ditemukan`);
}

async function openCamera(deviceId: string): Promise<void> {
  startBtn.disabled = true;
  const { width, height } = await camera.open(deviceId || undefined);
  update({ cameraId: camera.activeDeviceId ?? deviceId });
  log(`Live: ${width}x${height}`, 'ok');
  showMessage(null);
  startBtn.disabled = busy;
}

async function initCamera(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    showMessage('Browser ini tidak mendukung akses kamera.');
    log('getUserMedia tidak tersedia — buka lewat https:// atau http://localhost', 'err');
    return;
  }
  try {
    showMessage('Meminta izin kamera…');
    await camera.requestPermission();
    await refreshCameraList();
    await openCamera(camSel.value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showMessage('Kamera tidak bisa dibuka. Cek izin kamera di browser.');
    log(`Kamera diblokir: ${msg}`, 'err');
  }
}

camSel.addEventListener('change', () => {
  openCamera(camSel.value).catch((e: Error) => log(e.message, 'err'));
});
navigator.mediaDevices?.addEventListener('devicechange', () => {
  refreshCameraList().catch((e: Error) => log(e.message, 'err'));
});

/* ---------- Session ---------- */
function clearResults(): void {
  results.hidden = true;
  guestQr.hidden = true;
  linksEl.replaceChildren();
  sheetImg.removeAttribute('src');
  gifImg.removeAttribute('src');
  guestQrImg.removeAttribute('src');
  revokeObjectUrls();
  lastSheet = null;
}

async function capture(signal: AbortSignal): Promise<HTMLCanvasElement[]> {
  const deck = DECKS[settings.deck];
  const shots: HTMLCanvasElement[] = [];
  promptEl.hidden = false;
  pipsEl.hidden = false;

  for (let i = 0; i < SHOTS; i++) {
    renderPips(i);
    promptEl.textContent = deck.prompts[i] ?? 'Bebas';
    await sleep(PROMPT_MS, signal);

    for (let n = COUNTDOWN_FROM; n > 0; n--) {
      countEl.textContent = String(n);
      restartAnimation(countEl, 'is-pulsing');
      await sleep(1000, signal);
    }
    countEl.textContent = '';

    restartAnimation(flashEl, 'is-firing');
    shots.push(camera.grab(settings.mirror));
    log(`Foto ${i + 1}/${SHOTS}`);
    await sleep(AFTER_SHOT_MS, signal);
  }
  renderPips(SHOTS);
  return shots;
}

async function deliver(code: string, shots: HTMLCanvasElement[]): Promise<void> {
  await ensureFonts();
  const strip = buildStrip(shots, { code, eventName: settings.eventName, date: new Date() });
  const [sheetBlob, storyBlob] = await Promise.all([
    toJpeg(buildSheet(strip)),
    toJpeg(buildStory(strip)),
  ]);
  const gifBlob = buildGif(shots);
  const kb = (b: Blob) => `${Math.round(b.size / 1024)}KB`;
  log(`Dibuat: sheet ${kb(sheetBlob)} · story ${kb(storyBlob)} · gif ${kb(gifBlob)}`);

  sheetLink.href = sheetImg.src = objectUrl(sheetBlob);
  gifLink.href = gifImg.src = objectUrl(gifBlob);
  resultCode.textContent = code;
  results.hidden = false;
  lastSheet = { blob: sheetBlob, code };

  // The print sheet always goes to this machine for the printer, on top of any cloud copy.
  download(sheetBlob, `sheet-${code}.jpg`);
  log(`Download sheet-${code}.jpg`);

  const jobs: [AssetKey, string, Blob, string][] = [
    ['sheet', 'Sheet', sheetBlob, `sheet-${code}.jpg`],
    ['story', 'Story', storyBlob, `story-${code}.jpg`],
    ['gif', 'GIF', gifBlob, `anim-${code}.gif`],
  ];

  if (!hasCloud(settings)) {
    log('Cloud belum diatur — story & GIF di-download lokal', 'err');
    for (const [key, , blob, filename] of jobs) {
      if (key === 'sheet') continue;
      download(blob, filename);
      await sleep(500);
    }
    return;
  }

  const outcomes = await Promise.allSettled(
    jobs.map(([key, , blob]) =>
      uploadUnsigned(settings.cloudName, settings.uploadPreset, blob, publicId(code, key)),
    ),
  );

  let allUploaded = true;
  for (const [i, outcome] of outcomes.entries()) {
    const [key, label, blob, filename] = jobs[i];
    if (outcome.status === 'fulfilled') {
      log(`Upload ${label} → ${outcome.value}`, 'ok');
      continue;
    }
    allUploaded = false;
    log(`Upload ${label} gagal — ${(outcome.reason as Error).message}`, 'err');
    if (key !== 'sheet') {
      download(blob, filename);
      await sleep(500);
    }
  }

  if (!allUploaded) return;
  if (!settings.galleryUrl) {
    log('Upload berhasil, tapi URL galeri kosong — QR tidak dibuat', 'err');
    return;
  }

  let link: string;
  try {
    link = galleryLink(settings.galleryUrl, code);
  } catch {
    log(`URL galeri tidak valid: ${settings.galleryUrl}`, 'err');
    return;
  }
  addLink('Galeri', link);
  guestQrImg.src = await QRCode.toDataURL(link, { margin: 1, width: 480 });
  guestQrCode.textContent = code;
  guestQr.hidden = false;
}

async function runSession(): Promise<void> {
  if (busy || !camera.ready) return;
  busy = true;
  abort = new AbortController();
  const code = generateSessionCode();

  clearResults();
  startBtn.disabled = true;
  resetBtn.disabled = false; // doubles as "cancel" while running
  viewfinder.classList.remove('is-idle');
  log(`Kode sesi: ${code}`);

  try {
    const shots = await capture(abort.signal);
    resetBtn.disabled = true; // past the point of cancelling
    promptEl.textContent = 'Lagi nyiapin foto kamu…';
    await deliver(code, shots);
  } catch (err) {
    if (err instanceof Cancelled) log('Sesi dibatalkan');
    else log(err instanceof Error ? err.message : String(err), 'err');
  } finally {
    countEl.textContent = '';
    promptEl.hidden = true;
    pipsEl.hidden = true;
    viewfinder.classList.add('is-idle');
    busy = false;
    abort = null;
    startBtn.disabled = !camera.ready;
    resetBtn.disabled = results.hidden;
  }
}

function reset(): void {
  if (abort) {
    abort.abort();
    return;
  }
  if (busy) return;
  clearResults();
  resetBtn.disabled = true;
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

/* ---------- Wire up ---------- */
startBtn.addEventListener('click', () => void runSession());
resetBtn.addEventListener('click', reset);
fullscreenBtn.addEventListener('click', () => void toggleFullscreen().catch(() => {}));
redownloadBtn.addEventListener('click', () => {
  if (lastSheet) download(lastSheet.blob, `sheet-${lastSheet.code}.jpg`);
});

document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea')) return;
  if (e.code === 'Space') {
    // Space on a focused button already "clicks" it — don't double-handle.
    if (target.closest('button, summary, a')) return;
    e.preventDefault();
    void runSession();
  } else if (e.key === 'Escape') {
    reset();
  } else if (e.key === 'f' || e.key === 'F') {
    void toggleFullscreen().catch(() => {});
  }
});

bindSettings();
void initCamera();
