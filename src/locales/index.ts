import { useSettings } from "@/contexts/SettingsContext";
import en from "./en";
import vi from "./vi";

export type { Translations } from "./en";

const translations = { en, vi } as const;

export function useTranslation() {
  const { lang } = useSettings();
  return translations[lang];
}
