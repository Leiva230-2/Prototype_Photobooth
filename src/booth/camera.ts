/**
 * The same getUserMedia path works for the MacBook camera, an iPhone via
 * Continuity Camera, and later a DSLR through an HDMI capture card — the
 * capture card just shows up as another video input.
 */
export class Camera {
  private stream: MediaStream | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  /** Device labels stay blank until permission is granted, so ask first. */
  async requestPermission(): Promise<void> {
    const probe = await navigator.mediaDevices.getUserMedia({ video: true });
    probe.getTracks().forEach((t) => t.stop());
  }

  async list(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  async open(deviceId?: string): Promise<{ width: number; height: number }> {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    const { width = 0, height = 0 } = this.stream.getVideoTracks()[0].getSettings();
    return { width, height };
  }

  get activeDeviceId(): string | undefined {
    return this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
  }

  get ready(): boolean {
    return !!this.stream && this.video.videoWidth > 0;
  }

  /** Grabs a frame at the camera's native resolution. */
  grab(mirror: boolean): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.video.videoWidth;
    c.height = this.video.videoHeight;
    const ctx = c.getContext('2d')!;
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, 0, 0);
    return c;
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
