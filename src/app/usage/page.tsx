"use client";

import { useState, useEffect } from "react";
import { getUsageStats, clearUsageStats, type UsageStats } from "@/lib/apiUsage";

const ENDPOINTS = [
  { key: "/api/translate", label: "Translate", unit: "characters" },
  { key: "/api/tts", label: "Text-to-Speech", unit: "characters" },
  { key: "/api/define", label: "Define", unit: "characters" },
  { key: "/api/speech", label: "Speech", unit: "characters" },
];

const COST_ESTIMATES: { name: string; rate: number; per: string; endpoint: string; perUnit: number }[] = [
  { name: "Google Cloud Translation", rate: 20, per: "1M chars", endpoint: "/api/translate", perUnit: 1_000_000 },
  { name: "DeepL API", rate: 25, per: "1M chars", endpoint: "/api/translate", perUnit: 1_000_000 },
  { name: "Google Cloud TTS", rate: 16, per: "1M chars", endpoint: "/api/tts", perUnit: 1_000_000 },
  { name: "OpenAI TTS", rate: 15, per: "1M chars", endpoint: "/api/tts", perUnit: 1_000_000 },
  { name: "Google Cloud STT", rate: 1.44, per: "1hr", endpoint: "/api/speech", perUnit: 1_000_000 },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setStats(getUsageStats());
  }, []);

  function handleClear() {
    clearUsageStats();
    setStats(getUsageStats());
    setConfirmClear(false);
  }

  if (!stats) return null;

  const last7 = getLast7Days();
  const totalChars = Object.values(stats.totals).reduce((s, e) => s + e.chars, 0);

  return (
    <main className="min-h-screen bg-white pt-14 transition-colors md:pt-0 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            API Usage
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track API calls to estimate costs for paid services
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {ENDPOINTS.map((ep) => {
            const data = stats.totals[ep.key];
            return (
              <div
                key={ep.key}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {ep.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {data ? formatNumber(data.calls) : 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  call{(!data || data.calls !== 1) ? "s" : ""}
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {data ? formatNumber(data.chars) : 0} {ep.unit}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily breakdown — last 7 days */}
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Last 7 Days
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  {ENDPOINTS.map((ep) => (
                    <th
                      key={ep.key}
                      className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      {ep.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {last7.map((date) => {
                  const dayData = stats.daily.find((d) => d.date === date);
                  return (
                    <tr
                      key={date}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        {formatDate(date)}
                      </td>
                      {ENDPOINTS.map((ep) => {
                        const epData = dayData?.endpoints[ep.key];
                        return (
                          <td
                            key={ep.key}
                            className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400"
                          >
                            {epData ? (
                              <span>
                                {epData.calls} call{epData.calls !== 1 ? "s" : ""}
                                <span className="ml-1 text-gray-400 dark:text-gray-500">
                                  ({formatNumber(epData.chars)})
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost estimator */}
        <div className="mt-10">
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cost Estimator
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Estimated costs based on your actual usage per endpoint
          </p>
          <div className="space-y-3">
            {COST_ESTIMATES.map((est) => {
              const epChars = stats.totals[est.endpoint]?.chars ?? 0;
              const cost = (epChars / est.perUnit) * est.rate;
              return (
                <div
                  key={est.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {est.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${est.rate}/{est.per}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    ${cost.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clear data */}
        <div className="mt-10 flex items-center justify-end gap-3">
          {confirmClear ? (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Clear all usage data?
              </span>
              <button
                onClick={handleClear}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Clear usage data
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
