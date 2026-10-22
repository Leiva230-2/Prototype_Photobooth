/**
 * Sends the live camera picture to the tablet as small JPEG frames. Simple
 * and good enough for posing; over the USB cable it runs at ~12 fps.
 */
export class PreviewStream {
  private timer = 0;
  private encoding = false;
  private readonly canvas = document.createElement('canvas');
  mirror = true;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly send: (frame: Blob) => void,
    private readonly canSend: () => boolean,
    private readonly opts = { fps: 12, width: 640, quality: 0.6 },
  ) {}

  get running(): boolean {
    return this.timer !== 0;
  }

  start(): void {
    if (this.timer) return;
    this.timer = window.setTimeout(this.tick, 0);
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  private tick = (): void => {
    this.timer = window.setTimeout(this.tick, 1000 / this.opts.fps);
    const { videoWidth: vw, videoHeight: vh } = this.video;
    if (this.encoding || vw === 0 || !this.canSend()) return;

    const w = this.opts.width;
    const h = Math.round((w * vh) / vw);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(this.mirror ? -1 : 1, 0, 0, 1, this.mirror ? w : 0, 0);
    ctx.drawImage(this.video, 0, 0, w, h);

    this.encoding = true;
    this.canvas.toBlob(
      (blob) => {
        this.encoding = false;
        if (blob && this.timer) this.send(blob);
      },
      'image/jpeg',
      this.opts.quality,
    );
  };
}
