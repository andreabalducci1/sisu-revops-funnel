/**
 * Locale resolution for the funnel.
 *
 * English is the default and is returned as the untouched config object, so
 * every existing route renders exactly as before and needed no changes.
 */
import en from "../config";
import fr from "../config.fr";
import type { AppConfig } from "./translate";

export type Locale = "en" | "fr";

export const LOCALES = ["en", "fr"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "en";

const CONFIGS: Record<Locale, AppConfig> = { en, fr };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Never throws: an unknown locale falls back to English. */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getConfig(locale: Locale = DEFAULT_LOCALE): AppConfig {
  return CONFIGS[locale] ?? en;
}

/** `lang` attribute for <html>. */
export function htmlLang(locale: Locale): string {
  return locale;
}

export type { AppConfig };
