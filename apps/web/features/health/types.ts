// Shapes returned by the backend's /api/monitoring routes

export interface Bucket {
  start: string;
  errors: number;
  warnings: number;
}

export interface Summary {
  generatedAt: string;
  rangeHours: number;
  totals: { errors: number; warnings: number; slow: number; webErrors: number };
  topPaths: { method: string; path: string; count: number; errors: number; commonStatus: number }[];
  timeline: Bucket[];
  server: { uptimeSeconds: number; dbLatencyMs: number; memoryMb: number };
}

export interface LogEntry {
  id: string;
  createdAt: string;
  level: 'error' | 'warn';
  source: 'api' | 'web';
  method: string | null;
  path: string;
  status: number | null;
  durationMs: number | null;
  message: string | null;
  code: string | null;
  // Only filled in for super admins
  detail: string | null;
  user: { id: string; name: string; email: string } | null;
}

// Tailwind red-700 and amber-600: checked to stay apart for colour-blind and full-colour vision, with 3:1
// contrast against white. Always shown with an icon and a label too, never colour alone.
export const LEVEL_STYLE = {
  error: { bar: 'bg-red-700', icon: '●', text: 'text-red-700', badge: 'bg-red-50 text-red-700' },
  warn: { bar: 'bg-amber-600', icon: '▲', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-800' },
} as const;
