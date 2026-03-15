const STORAGE_KEY = "api_usage";
const MAX_AGE_DAYS = 30;

interface UsageEntry {
  endpoint: string;
  chars: number;
  timestamp: number;
}

interface EndpointStats {
  calls: number;
  chars: number;
}

interface DailyStats {
  date: string;
  endpoints: Record<string, EndpointStats>;
}

export interface UsageStats {
  totals: Record<string, EndpointStats>;
  daily: DailyStats[];
}

function readEntries(): UsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const entries: UsageEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const pruned = entries.filter((e) => e.timestamp >= cutoff);
    if (pruned.length < entries.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

export function logApiCall(endpoint: string, chars: number): void {
  if (typeof window === "undefined") return;
  const entries = readEntries();
  entries.push({ endpoint, chars, timestamp: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getUsageStats(): UsageStats {
  const entries = readEntries();
  const totals: Record<string, EndpointStats> = {};
  const dailyMap: Record<string, Record<string, EndpointStats>> = {};

  for (const entry of entries) {
    // Totals
    if (!totals[entry.endpoint]) {
      totals[entry.endpoint] = { calls: 0, chars: 0 };
    }
    totals[entry.endpoint].calls++;
    totals[entry.endpoint].chars += entry.chars;

    // Daily
    const date = new Date(entry.timestamp).toISOString().slice(0, 10);
    if (!dailyMap[date]) dailyMap[date] = {};
    if (!dailyMap[date][entry.endpoint]) {
      dailyMap[date][entry.endpoint] = { calls: 0, chars: 0 };
    }
    dailyMap[date][entry.endpoint].calls++;
    dailyMap[date][entry.endpoint].chars += entry.chars;
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, endpoints]) => ({ date, endpoints }));

  return { totals, daily };
}

export function clearUsageStats(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
