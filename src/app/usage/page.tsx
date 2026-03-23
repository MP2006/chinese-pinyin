"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/locales";
import { getUsageStats, clearUsageStats, type UsageStats } from "@/lib/apiUsage";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

const COST_ESTIMATES: { name: string; rate: number; per: string; endpoint: string; perUnit: number }[] = [
  { name: "Google Cloud Translation", rate: 20, per: "1M chars", endpoint: "/api/translate", perUnit: 1_000_000 },
  { name: "DeepL API", rate: 25, per: "1M chars", endpoint: "/api/translate", perUnit: 1_000_000 },
  { name: "Google Cloud TTS", rate: 16, per: "1M chars", endpoint: "/api/tts", perUnit: 1_000_000 },
  { name: "OpenAI TTS", rate: 15, per: "1M chars", endpoint: "/api/tts", perUnit: 1_000_000 },
  { name: "Google Cloud STT", rate: 1.44, per: "1hr", endpoint: "/api/speech", perUnit: 1_000_000 },
  { name: "Gemini 2.5 Flash", rate: 0.15, per: "1M chars", endpoint: "/api/analyze-grammar", perUnit: 1_000_000 },
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslation();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const isAdmin = ADMIN_EMAIL && user?.email === ADMIN_EMAIL;

  const endpoints = [
    { key: "/api/translate", label: t.usage.translate, unit: t.usage.characters },
    { key: "/api/tts", label: t.usage.tts, unit: t.usage.characters },
    { key: "/api/define", label: t.usage.define, unit: t.usage.characters },
    { key: "/api/speech", label: t.usage.speech, unit: t.usage.characters },
    { key: "/api/analyze-grammar", label: t.usage.grammar, unit: t.usage.characters },
  ];

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/");
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      setStats(getUsageStats());
    }
  }, [isAdmin]);

  function handleClear() {
    clearUsageStats();
    setStats(getUsageStats());
    setConfirmClear(false);
  }

  if (authLoading || !isAdmin || !stats) return null;

  const last7 = getLast7Days();

  return (
    <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-text-heading">
            {t.usage.title}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t.usage.subtitle}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {endpoints.map((ep) => {
            const data = stats.totals[ep.key];
            return (
              <div
                key={ep.key}
                className="rounded-xl border border-border bg-surface-card p-6"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {ep.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-text-heading">
                  {data ? formatNumber(data.calls) : 0}
                </div>
                <div className="text-xs text-text-secondary">
                  {t.usage.calls(data?.calls ?? 0)}
                </div>
                <div className="mt-1 text-sm text-text-body">
                  {data ? formatNumber(data.chars) : 0} {ep.unit}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily breakdown — last 7 days */}
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-text-heading">
            {t.usage.last7Days}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50 dark:bg-gray-800/80">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    {t.usage.date}
                  </th>
                  {endpoints.map((ep) => (
                    <th
                      key={ep.key}
                      className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-secondary"
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
                      <td className="px-4 py-2.5 text-text-label">
                        {formatDate(date)}
                      </td>
                      {endpoints.map((ep) => {
                        const epData = dayData?.endpoints[ep.key];
                        return (
                          <td
                            key={ep.key}
                            className="px-4 py-2.5 text-right tabular-nums text-text-body"
                          >
                            {epData ? (
                              <span>
                                {epData.calls} {t.usage.calls(epData.calls)}
                                <span className="ml-1 text-text-muted">
                                  ({formatNumber(epData.chars)})
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
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
        <div className="mt-12">
          <h2 className="mb-2 text-lg font-semibold text-text-heading">
            {t.usage.costEstimator}
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            {t.usage.costDesc}
          </p>
          <div className="space-y-3">
            {COST_ESTIMATES.map((est) => {
              const epChars = stats.totals[est.endpoint]?.chars ?? 0;
              const cost = (epChars / est.perUnit) * est.rate;
              return (
                <div
                  key={est.name}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-card px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-text-heading">
                      {est.name}
                    </div>
                    <div className="text-xs text-text-secondary">
                      ${est.rate}/{est.per}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-text-heading">
                    ${cost.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clear data */}
        <div className="mt-12 flex items-center justify-end gap-3">
          {confirmClear ? (
            <>
              <span className="text-sm text-text-secondary">
                {t.usage.clearConfirm}
              </span>
              <button
                onClick={handleClear}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {t.usage.confirm}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="rounded-lg border border-border-input px-4 py-2 text-sm font-medium text-text-label transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t.common.cancel}
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="rounded-lg border border-border-input px-4 py-2 text-sm font-medium text-text-label transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t.usage.clearData}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
