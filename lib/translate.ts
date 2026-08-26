/**
 * Locale overlay.
 *
 * A translated config is built by overlaying strings onto the English one,
 * never by hand-writing a parallel object. lib/scoring.ts resolves answers by
 * question id and option id, so a renamed id does not fail: it silently scores
 * wrong, and the band, the report and the HubSpot heat are all wrong with it.
 * Overlaying makes that drift structurally impossible, because ids, scores,
 * weights and band boundaries are inherited and never retyped.
 */
import type config from "../config";

export type AppConfig = typeof config;

/**
 * config.ts is a deep `as const` literal, so the clone needs types that are
 * both writable AND widened: every string is a literal union type there, and a
 * translation is just `string`.
 */
type Widen<T> = T extends string ? string : T extends number ? number : T;
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : Widen<T>;

export interface Translation {
  landing?: Partial<Record<keyof AppConfig["landing"], unknown>>;
  /** config.ts infers literal string types, so translations widen to string. */
  ui?: Partial<Record<keyof AppConfig["ui"], string>>;
  /** Dimension id -> label. */
  dimensions?: Record<string, string>;
  /** Band index -> label and teaser. Boundaries are never translated. */
  bands?: { label: string; teaser: string }[];
  /** quiz.intro and quiz.calibration copy. */
  intro?: { startCta?: string; note?: string };
  calibration?: { eyebrow?: string };
  /** The optional 'put a number on it' step. */
  numbers?: {
    eyebrow?: string;
    title?: string;
    note?: string;
    skipCta?: string;
    submitCta?: string;
    /** Field id -> label, and optional placeholder. */
    fields?: Record<string, { label?: string; placeholder?: string }>;
  };
  /** Cohort (calibration) question id -> label, plus option id -> label. */
  cohort?: Record<string, { label?: string; options?: Record<string, string> }>;
  /** Question id -> prompt, plus option id -> label. */
  questions?: Record<
    string,
    { prompt?: string; rationale?: string; options?: Record<string, string> }
  >;
}

export function localize(base: AppConfig, t: Translation): AppConfig {
  const out = structuredClone(base) as unknown as DeepMutable<AppConfig>;

  if (t.landing) Object.assign(out.landing, t.landing);
  if (t.ui) Object.assign(out.ui, t.ui);
  if (t.intro) Object.assign(out.quiz.intro, t.intro);
  if (t.calibration) Object.assign(out.quiz.calibration, t.calibration);

  if (t.dimensions) {
    for (const d of out.quiz.dimensions) {
      const label = t.dimensions[d.id];
      if (label) d.label = label;
    }
  }

  if (t.bands) {
    out.quiz.bands.forEach((b, i) => {
      const tr = t.bands?.[i];
      if (tr) {
        b.label = tr.label;
        b.teaser = tr.teaser;
      }
    });
  }

  if (t.numbers) {
    const { fields, ...top } = t.numbers;
    Object.assign(out.quiz.numbers, top);
    if (fields) {
      for (const f of out.quiz.numbers.fields) {
        const tr = fields[f.id];
        if (!tr) continue;
        if (tr.label) f.label = tr.label;
        if (tr.placeholder && "placeholder" in f) {
          (f as { placeholder: string }).placeholder = tr.placeholder;
        }
      }
    }
  }

  if (t.cohort) {
    for (const c of out.quiz.cohort) {
      const tr = t.cohort[c.id];
      if (!tr) continue;
      if (tr.label) c.label = tr.label;
      if (tr.options) {
        for (const o of c.options) {
          const label = tr.options[o.id];
          if (label) o.label = label;
        }
      }
    }
  }

  if (t.questions) {
    for (const q of out.quiz.questions) {
      const tr = t.questions[q.id];
      if (!tr) continue;
      if (tr.prompt) q.prompt = tr.prompt;
      if (tr.rationale && "rationale" in q) {
        (q as { rationale: string }).rationale = tr.rationale;
      }
      if (tr.options) {
        for (const o of q.options) {
          const label = tr.options[o.id];
          if (label) o.label = label;
        }
      }
    }
  }

  return out as unknown as AppConfig;
}

/** Keys whose values are structural, not copy. */
const STRUCTURAL = new Set([
  "id", "dimension", "score", "weight", "effort", "min", "max", "maxTokens",
  // Proper nouns and identifiers: identical across locales by design.
  "name", "domain", "theme", "companyName", "contactEmail", "privacyUrl",
  "type", "unit",   // input type and unit symbol, not prose
  "colorPrimary", "colorAccent", "colorBg", "siteUrl", "calUsername",
  "calEventSlug", "scoreUnit", "score",
]);

function isCopy(key: string, value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  if (STRUCTURAL.has(key)) return false;
  if (/^https?:\/\//.test(value)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return false;
  if (/^[\d\s/.,%-]+$/.test(value)) return false;   // "72", "/ 100"
  return true;
}

/**
 * Every copy string in `localized` still identical to `base`, as dotted paths.
 *
 * Walks the WHOLE config tree on purpose. The first version of this only
 * checked the handful of fields the author remembered, reported zero gaps, and
 * missed quiz.intro, quiz.calibration, quiz.cohort and quiz.numbers entirely.
 * A completeness check that only inspects what you thought of is not a
 * completeness check.
 */
export function untranslated(base: AppConfig, localized: AppConfig): string[] {
  const gaps: string[] = [];
  const walk = (a: unknown, b: unknown, path: string, key: string): void => {
    if (Array.isArray(a) && Array.isArray(b)) {
      a.forEach((item, i) => walk(item, b[i], `${path}[${i}]`, key));
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const k of Object.keys(a as object)) {
        walk((a as never)[k], (b as never)[k], path ? `${path}.${k}` : k, k);
      }
      return;
    }
    if (isCopy(key, a) && a === b) gaps.push(path);
  };
  walk(base, localized, "", "");
  return gaps;
}
