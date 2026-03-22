"use client";

import { useSettings } from "@/contexts/SettingsContext";
import type { Lang } from "@/contexts/SettingsContext";
import { useTranslation } from "@/locales";

export default function SettingsPage() {
  const { lang, setLang } = useSettings();
  const t = useTranslation();

  const langOptions: { value: Lang; label: string }[] = [
    { value: "en", label: t.settings.english },
    { value: "vi", label: t.settings.vietnamese },
  ];

  return (
    <main className="min-h-screen bg-surface-page pt-14 transition-colors md:pt-0">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-text-heading">
          {t.settings.title}
        </h1>

        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-text-muted">
            {t.settings.language}
          </h2>
          <div className="mt-3 rounded-lg border border-border bg-surface-card p-5">
            <label
              htmlFor="lang-select"
              className="block text-sm font-medium text-text-label"
            >
              {t.settings.languageLabel}
            </label>
            <p className="mt-1 text-xs text-text-muted">
              {t.settings.languageDesc}
            </p>
            <select
              id="lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="mt-3 rounded-md border border-border-input bg-surface-card px-3 py-2 text-sm text-text-heading focus:border-primary-text focus:outline-none dark:bg-surface-hover"
            >
              {langOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>
    </main>
  );
}
