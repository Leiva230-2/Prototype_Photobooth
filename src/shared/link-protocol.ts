import type { DeckId } from '../booth/config';
import type { GuestView } from './view';

/** WebSocket path on the dev server that connects the Mac and the tablet. */
export const LINK_PATH = '/booth-link';

export type Role = 'host' | 'guest';

/** Taps on the guest screen, sent to the Mac. */
export type GuestIntent =
  | { type: 'start' }
  | { type: 'deck'; deck: DeckId }
  | { type: 'cancel' }
  | { type: 'finish' };

export type LinkMessage =
  /** Mac → tablet: what to show. */
  | { type: 'state'; view: GuestView }
  /** Tablet → Mac: what the guest tapped. */
  | { type: 'intent'; intent: GuestIntent }
  /** Hub → everyone: who is connected. */
  | { type: 'peers'; hosts: number; guests: number };

// Live preview frames travel as binary messages (JPEG blobs) from the Mac to the tablet.
