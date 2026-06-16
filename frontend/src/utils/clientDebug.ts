import { createClientId } from './id';

const DEBUG_ENDPOINT = '/api/debug/client-event';
const sessionId = createClientId('client');

type DebugDetails = Record<string, string | number | boolean | null | undefined>;

export function reportClientEvent(event: string, details: DebugDetails = {}): void {
  const compactDetails = JSON.stringify(details);

  try {
    const params = new URLSearchParams({
      event,
      session_id: sessionId,
      details: compactDetails.slice(0, 1200),
      t: String(Date.now()),
    });
    new Image().src = `${DEBUG_ENDPOINT}?${params.toString()}`;
  } catch {
    // Keep going to the POST fallbacks below.
  }

  const payload = JSON.stringify({
    event,
    session_id: sessionId,
    url: window.location.href,
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    details,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon(DEBUG_ENDPOINT, blob)) {
        return;
      }
    }

    void fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Debug reporting must never affect chat behavior.
  }
}

export function installClientDebugHandlers(): void {
  window.addEventListener('error', (event) => {
    reportClientEvent('window_error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    reportClientEvent('unhandled_rejection', {
      reason,
    });
  });

  window.addEventListener('pagehide', () => {
    reportClientEvent('pagehide');
  });
}
