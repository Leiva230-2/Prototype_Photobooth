import { DEFAULT_CLOUD_NAME } from '../shared/cloudinary';
import type { DeckId } from './config';

/** Operator settings, remembered across reloads so the booth survives a refresh mid-event. */
export interface Settings {
  cameraId: string;
  deck: DeckId;
  mirror: boolean;
  cloudName: string;
  uploadPreset: string;
  galleryUrl: string;
  eventName: string;
}

const KEY = 'photobooth.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  cameraId: '',
  deck: 'BESTIE',
  mirror: true,
  cloudName: DEFAULT_CLOUD_NAME,
  uploadPreset: '',
  galleryUrl: '',
  eventName: 'BINUS UNIVERSITY',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Private mode or corrupt JSON — fall back to defaults.
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not fatal; settings just won't persist.
  }
}

export function hasCloud(s: Settings): boolean {
  return s.cloudName.trim() !== '' && s.uploadPreset.trim() !== '';
}
