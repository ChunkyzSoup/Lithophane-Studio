type LogDetails = Record<string, unknown> | Error | string | number | null;

function shouldLog() {
  return import.meta.env.DEV;
}

export function debugLog(scope: string, message: string, details?: LogDetails) {
  if (!shouldLog()) {
    return;
  }

  console.debug(`[lithophane:${scope}] ${message}`, details ?? "");
}

export function warnLog(scope: string, message: string, details?: LogDetails) {
  if (!shouldLog()) {
    return;
  }

  console.warn(`[lithophane:${scope}] ${message}`, details ?? "");
}
