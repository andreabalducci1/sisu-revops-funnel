/**
 * Cited, dated benchmark constants.
 *
 * Every value here gets printed on a public page next to arithmetic, in front
 * of an audience that checks. Each entry therefore carries its publisher, year
 * and URL. A value that could not be verified against a primary source is
 * marked verified:false and its dependent leak line is omitted rather than
 * estimated (see the leak model in a later task).
 *
 * Verification record (2026-08-08), one entry per Step 1 claim:
 *
 * 1. Lead-to-opportunity conversion, sub-5-minute vs over-1-hour response.
 *    Primary source: James B. Oldroyd, Kristina McElheran, David Elkington,
 *    "The Short Life of Online Sales Leads," Harvard Business Review 89, no. 3
 *    (March 2011). https://hbr.org/2011/03/the-short-life-of-online-sales-leads
 *    Confirmed real (checked against hbr.org's own listing and the Harvard
 *    Business School faculty page, https://www.hbs.edu/faculty/Pages/item.aspx?num=39955):
 *    a controlled study that audited 2,241 US companies with a real test lead
 *    and measured response time against qualification odds. It is the origin
 *    of essentially every "5 minutes vs X" statistic still quoted today. The
 *    full text is paywalled, so the exact multiples (widely reported
 *    secondhand as roughly 21x qualification, 100x contact, for 5 minutes vs
 *    30 minutes) could not be confirmed directly against the original tables.
 *    Not shipped as a dated BENCHMARKS entry (it predates this file's 2023
 *    freshness bar, see claim 2 below). It informs RESPONSE_BUCKETS.leadToOpp
 *    only, and only directionally: the spread actually coded there (5 points,
 *    0.08 to 0.13) is deliberately far more modest than the study's headline
 *    multiples, because this number is multiplied by other user inputs later
 *    and errors compound. Cross-checked for continued relevance against three
 *    2023+ vendor studies: RevenueHero 2024 (1,000 B2B SaaS companies tested),
 *    Chili Piper's 2025 benchmark report (4M form submissions), and Blazeo's
 *    2026 Speed-to-Lead Benchmark Report (573 companies). All three treat "5
 *    minutes" as the live industry reference point and confirm response speed
 *    still predicts conversion in 2024-2026, but none republishes a bucketed
 *    conversion table rigorous enough to replace the 2011 study as the
 *    number's source.
 *
 * 2. The 5-minute speed-to-lead threshold itself.
 *    Same source as claim 1. Genuinely verified as real and as the origin of
 *    the "5 minutes" figure. NOT marked verified:true below, because it is a
 *    2011 source and this file's own test requires year >= 2023 for anything
 *    shipped as a dated BENCHMARKS entry. No 2023+ primary source was found
 *    that independently re-establishes the 5-minute mark with comparable
 *    rigor; recent vendor reports (see claim 1) cite it as received wisdom
 *    rather than re-deriving it from their own data. Rather than backdate a
 *    fresher year onto a 2011 study, BENCHMARKS.speedToLead ships with the
 *    real 2011 citation and verified:false. This is a recency failure, not an
 *    accuracy failure: the number is real, just older than this file allows.
 *
 * 3. A defensible loaded hourly cost for a Belgian revenue employee.
 *    Could not verify. What was checked:
 *    - Eurostat's official hourly labour cost figure for Belgium is real and
 *      current (EUR 48.2, whole economy, 2024): "EU hourly labour costs
 *      ranged from EUR 11 to EUR 55 in 2024," Eurostat, 28 March 2025,
 *      https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250328-1
 *      But it measures the whole economy (every sector, every role, including
 *      ones paid well below a sales/marketing/customer-success role), not a
 *      revenue-specific one. Using it as a stand-in for "revenue employee"
 *      would misrepresent what the source actually measures, so it is
 *      recorded below for reference but not used as the verified value.
 *    - Statbel's Structure of Earnings Survey publishes wages by ISCO
 *      occupation but the public pages found did not expose a fetchable
 *      sales/marketing occupation figure.
 *    - Role-specific salary guides exist (Robert Half Belgium Salary Guide,
 *      Michael Page BeLux Salary Guide) but both gate their sales-role
 *      figures behind a login wall; the figures could not be fetched or
 *      confirmed.
 *    - A PayScale "Account Manager Sales, Belgium" figure (EUR 45,300/year)
 *      was fetchable but is crowdsourced from 6 salary profiles and last
 *      updated 2019: too thin a sample and too stale to defend in front of an
 *      audience that checks.
 *    BENCHMARKS.loadedHourly ships with the real Eurostat figure recorded for
 *    reference and verified:false. The dependent leak line should stay
 *    omitted until a role-specific figure is verified against a primary
 *    source.
 */

export interface Benchmark {
  value: number;
  label: string;
  source: string;
  year: number;
  url: string;
  verified: boolean;
}

/**
 * Ordered slowest to fastest. Shared with quiz question q_speed.
 *
 * The leadToOpp spread is deliberately conservative: real published research
 * (see the header comment, claim 1) reports a far larger gap between a
 * sub-5-minute and an over-1-hour response. A 5-point spread is used instead
 * of the study's headline multiples because this number gets multiplied by
 * three other user inputs downstream and any overstatement compounds fast.
 */
export const RESPONSE_BUCKETS = [
  { id: "over_day", label: "More than a day", leadToOpp: 0.08 },
  { id: "same_day", label: "Same day", leadToOpp: 0.1 },
  { id: "under_hour", label: "Within an hour", leadToOpp: 0.11 },
  { id: "under_5min", label: "Under 5 minutes", leadToOpp: 0.13 },
] as const;

export type ResponseBucket = (typeof RESPONSE_BUCKETS)[number]["id"] | "unknown";

/**
 * Conversion rate by response speed. Deliberately conservative: the spread
 * between slowest and fastest is 5 points, at the low end of what the source
 * range permits, because this figure is multiplied by three other user numbers
 * and compounds fast.
 */
export function leadToOppRate(bucket: string): number {
  const found = RESPONSE_BUCKETS.find((b) => b.id === bucket);
  // Unknown means unmeasured. Assume the slowest bucket rather than guessing up.
  return found ? found.leadToOpp : RESPONSE_BUCKETS[0].leadToOpp;
}

/** Belgian working year: roughly 52 weeks minus public holidays and statutory vacation. */
export const WEEKS_PER_YEAR = 46;

/**
 * Not verified: see header comment, claim 3. The Eurostat figure recorded
 * here is real (whole-economy Belgian hourly labour cost, 2024) but is not a
 * revenue-role-specific figure, so it is not a verified stand-in for this
 * benchmark's claim. Kept unverified rather than approximated.
 */
export const LOADED_HOURLY_EUR: Benchmark = {
  value: 48.2,
  label: "Loaded hourly labour cost, Belgium (whole-economy average, not role-specific)",
  source: "Eurostat, \"EU hourly labour costs ranged from EUR 11 to EUR 55 in 2024\" (whole economy, Belgium)",
  year: 2024,
  url: "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20250328-1",
  verified: false,
};

export const BENCHMARKS: Record<string, Benchmark> = {
  /**
   * Not verified: see header comment, claim 2. Real 2011 primary source, but
   * older than this file's 2023 freshness bar and no 2023+ source of
   * comparable rigor was found to replace it.
   */
  speedToLead: {
    value: 5,
    label: "Minutes to first contact, above which conversion drops sharply",
    source:
      "Oldroyd, McElheran & Elkington, \"The Short Life of Online Sales Leads,\" Harvard Business Review 89, no. 3",
    year: 2011,
    url: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads",
    verified: false,
  },
  loadedHourly: LOADED_HOURLY_EUR,
};
