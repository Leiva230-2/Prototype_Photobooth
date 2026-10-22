import '../styles/gallery.css';
import { attachmentUrl, DEFAULT_CLOUD_NAME, deliveryUrl, type AssetKey } from '../shared/cloudinary';
import { isValidSessionCode, normalizeSessionCode } from '../shared/session-code';

// Must match the cloud name the booth uploads to (set VITE_CLOUDINARY_CLOUD_NAME in .env).
const CLOUD_NAME = DEFAULT_CLOUD_NAME;

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const codeForm = $<HTMLFormElement>('codeForm');
const codeInput = $<HTMLInputElement>('codeInput');
const codeError = $('codeError');
const loading = $('loading');
const gallery = $('gallery');
const codeLabel = $('codeLabel');
const stripImg = $<HTMLImageElement>('stripImg');
const gifImg = $<HTMLImageElement>('gifImg');
const shareBtn = $<HTMLButtonElement>('shareBtn');
const iosHint = $('iosHint');
const downloadLinks: Record<AssetKey, HTMLAnchorElement> = {
  sheet: $<HTMLAnchorElement>('dlSheet'),
  story: $<HTMLAnchorElement>('dlStory'),
  gif: $<HTMLAnchorElement>('dlGif'),
};

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let currentCode = '';
let shareFiles: File[] | null = null;

function setCodeInUrl(code: string | null): void {
  const url = new URL(location.href);
  if (code) url.searchParams.set('s', code);
  else url.searchParams.delete('s');
  history.replaceState(null, '', url);
}

function showForm(message?: string): void {
  gallery.hidden = true;
  loading.hidden = true;
  codeForm.hidden = false;
  codeError.hidden = !message;
  codeError.textContent = message ?? '';
  codeInput.focus();
}

function loadImage(img: HTMLImageElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function showGallery(code: string): Promise<void> {
  if (!CLOUD_NAME) {
    showForm('Galeri belum dikonfigurasi (VITE_CLOUDINARY_CLOUD_NAME kosong).');
    return;
  }
  currentCode = code;
  codeForm.hidden = true;
  gallery.hidden = true;
  loading.hidden = false;

  try {
    // The story image is the single strip — nicer on a phone than the 2-up print sheet.
    await loadImage(stripImg, deliveryUrl(CLOUD_NAME, code, 'story'));
  } catch {
    if (currentCode !== code) return;
    setCodeInUrl(null);
    showForm('Foto untuk kode itu tidak ditemukan — cek lagi kodenya.');
    return;
  }
  if (currentCode !== code) return;

  gifImg.src = deliveryUrl(CLOUD_NAME, code, 'gif');
  for (const [asset, a] of Object.entries(downloadLinks) as [AssetKey, HTMLAnchorElement][]) {
    a.href = attachmentUrl(CLOUD_NAME, code, asset);
  }
  codeLabel.textContent = code;
  iosHint.hidden = !isIOS;
  loading.hidden = true;
  gallery.hidden = false;
  void prepareShare(code);
}

/**
 * Native share sheet (save to Photos / send to IG) on phones. Files are fetched
 * up front: share() must run straight from the tap, with no await before it.
 */
async function prepareShare(code: string): Promise<void> {
  shareFiles = null;
  shareBtn.hidden = true;
  if (!('canShare' in navigator)) return;
  try {
    const files = await Promise.all(
      (['story', 'gif'] as const).map(async (asset) => {
        const res = await fetch(deliveryUrl(CLOUD_NAME, code, asset));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const ext = asset === 'gif' ? 'gif' : 'jpg';
        return new File([blob], `dearly-${code}-${asset}.${ext}`, { type: blob.type });
      }),
    );
    if (currentCode !== code || !navigator.canShare({ files })) return;
    shareFiles = files;
    shareBtn.hidden = false;
  } catch {
    // Sharing is optional; the download links still work.
  }
}

codeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normalizeSessionCode(codeInput.value);
  if (!code) return;
  if (!isValidSessionCode(code)) {
    showForm('Kode harus 6 karakter (huruf & angka) seperti yang ada di strip.');
    return;
  }
  setCodeInUrl(code);
  void showGallery(code);
});

shareBtn.addEventListener('click', () => {
  if (!shareFiles) return;
  navigator.share({ files: shareFiles, title: 'Foto Dearly Photobooth' }).catch((err: Error) => {
    if (err.name !== 'AbortError') console.error(err);
  });
});

$('otherCodeBtn').addEventListener('click', () => {
  currentCode = '';
  codeInput.value = '';
  setCodeInUrl(null);
  showForm();
});

const initial = normalizeSessionCode(new URLSearchParams(location.search).get('s') ?? '');
if (isValidSessionCode(initial)) void showGallery(initial);
else showForm(initial ? 'Kode di link tidak valid — masukkan manual.' : undefined);
