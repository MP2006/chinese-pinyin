"use client";

import { useEffect } from "react";
import { useTranslation } from "@/locales";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslation();

  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-text-heading">
        {t.error.title}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {t.error.message}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
      >
        {t.error.tryAgain}
      </button>
    </div>
  );
}
