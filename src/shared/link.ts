import { LINK_PATH, type LinkMessage, type Role } from './link-protocol';

export interface LinkHandlers {
  onMessage(msg: LinkMessage): void;
  /** Binary preview frame (tablet only). */
  onFrame?(frame: Blob): void;
  onStatus?(connected: boolean): void;
}

/** WebSocket to the booth hub that reconnects on its own (cable pulled, server restarted…). */
export class Link {
  private ws: WebSocket | null = null;
  private retryMs = 500;
  private retryTimer = 0;
  private closed = false;

  constructor(
    private readonly role: Role,
    private readonly handlers: LinkHandlers,
  ) {
    this.connect();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Bytes queued but not yet sent — used to skip preview frames on a slow link. */
  get backlog(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  private connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}${LINK_PATH}?role=${this.role}`);
    ws.binaryType = 'blob';
    this.ws = ws;

    ws.onopen = () => {
      this.retryMs = 500;
      this.handlers.onStatus?.(true);
    };
    ws.onmessage = (e: MessageEvent) => {
      if (e.data instanceof Blob) {
        this.handlers.onFrame?.(e.data);
        return;
      }
      try {
        this.handlers.onMessage(JSON.parse(e.data as string) as LinkMessage);
      } catch {
        // Ignore malformed messages.
      }
    };
    ws.onclose = () => {
      this.handlers.onStatus?.(false);
      if (this.closed) return;
      this.retryTimer = window.setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 4000);
    };
    ws.onerror = () => ws.close();
  }

  send(msg: LinkMessage): void {
    if (this.connected) this.ws!.send(JSON.stringify(msg));
  }

  sendFrame(frame: Blob): void {
    if (this.connected) this.ws!.send(frame);
  }

  close(): void {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }
}
