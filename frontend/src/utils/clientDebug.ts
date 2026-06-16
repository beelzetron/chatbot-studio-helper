import { createClientId } from './id';

const DEBUG_ENDPOINT = '/api/debug/client-event';
const sessionId = createClientId('client');

type DebugDetails = Record<string, string | number | boolean | null | undefined>;

export function reportClientEvent(event: string, details: DebugDetails = {}): void {
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
