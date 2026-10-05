import { API_URL } from './api/client';

// One broken page shouldn't flood the log: each message once, and a few per page load
const MAX_REPORTS_PER_PAGE = 5;
const reported = new Set<string>();

// Sends an error from the browser to the API's log. Never throws: reporting must not cause more errors.
export function reportClientError(error: unknown, token?: string | null) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (reported.has(message) || reported.size >= MAX_REPORTS_PER_PAGE) return;
  reported.add(message);

  void fetch(`${API_URL}/api/monitoring/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ message, stack: error instanceof Error ? error.stack : undefined, url: window.location.href }),
    // Lets the report finish even if the page is closing
    keepalive: true,
  }).catch(() => {});
}

// For tests: forget what was reported
export const resetReportedErrors = () => reported.clear();
