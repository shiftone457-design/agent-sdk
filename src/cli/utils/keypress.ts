export interface KeyPressHandler {
  onAbort: () => void;
  onExit?: () => void;
}

let isActive = false;
let currentHandler: KeyPressHandler | null = null;

const onKeypress = (key: string) => {
  if (!isActive || !currentHandler) return;

  if (key === '\x1b' || key.charCodeAt(0) === 27) {
    currentHandler.onAbort();
  }
  if (key === '\u0003') {
    currentHandler.onExit?.() || process.exit(130);
  }
};

export function initKeypressListener(): () => void {
  if (!process.stdin.isTTY) {
    return () => {};
  }

  if (isActive) {
    return () => {};
  }

  isActive = true;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', onKeypress);

  return () => {
    if (!isActive) return;
    isActive = false;
    currentHandler = null;

    process.stdin.off('data', onKeypress);
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore
    }
  };
}

export function setKeypressHandler(handler: KeyPressHandler): void {
  currentHandler = handler;
}

export function clearKeypressHandler(): void {
  currentHandler = null;
}
