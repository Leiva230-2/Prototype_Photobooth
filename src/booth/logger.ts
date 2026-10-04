export type LogLevel = 'info' | 'ok' | 'err';

const MAX_LINES = 300;

export function createLogger(el: HTMLElement) {
  return function log(msg: string, level: LogLevel = 'info'): void {
    const line = document.createElement('div');
    line.className = `log-line log-${level}`;
    const time = new Date().toLocaleTimeString('en-GB');
    line.textContent = `${time}  ${msg}`;
    el.append(line);
    while (el.childElementCount > MAX_LINES) el.firstElementChild?.remove();
    el.scrollTop = el.scrollHeight;
    if (level === 'err') console.error(msg);
  };
}

export type Logger = ReturnType<typeof createLogger>;
