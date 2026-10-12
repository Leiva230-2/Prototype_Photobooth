export class Cancelled extends Error {
  constructor() {
    super('Cancelled');
  }
}

/** setTimeout as a promise that rejects with Cancelled when the signal aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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
