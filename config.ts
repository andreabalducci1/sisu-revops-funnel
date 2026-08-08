/**
 * SiSu RevOps Funnel - central configuration (SINGLE SOURCE OF TRUTH)
 *
 * Every page reads this file. To customize the funnel, edit values here
 * (copy, colors, links). Pages contain no hardcoded text or color.
 *
 * The default content below is a working demo so the funnel renders fully
 * on `npm run dev`. Offer specifics (bootcamp name, price, promise) are
 * placeholders to finalize during onboarding.
 */

export type DimensionId = "data" | "pipeline" | "reporting" | "automation" | "stack" | "ai";

export interface QuizOptionConfig {
  id: string;
  label: string;
  score: number;
  /** Marks "Not sure". Scores 0 but is reported as unmeasured, not as bad. */
  unknown?: boolean;
}

export interface QuizQuestionConfig {
  id: string;
  dimension: DimensionId;
  prompt: string;
  /** One line rendered under the question so value starts at question one. */
  rationale?: string;
  options: QuizOptionConfig[];
}

export interface DimensionConfig {
  id: DimensionId;
  label: string;
  /** Published on the results page. The six weights sum to 100. */
  weight: number;
  /** 1 to 3. How much work the fix typically is. Used to rank fixes. */
  effort: 1 | 2 | 3;
}

const config = {
  business: {
    name: "SiSu RevOps",
    tagline: "Fractional RevOps and AI, wired into your revenue engine.",
    domain: "sisurevops.com",
    /** Main site. The funnel is a separate app, so it needs an explicit way back. */
    siteUrl: "https://www.sisurevops.com",
    backLabel: "Back to sisurevops.com",
  },

  brand: {
    // Colors mirror the CSS variables in globals.css. SiSu RevOps palette.
    colorPrimary: "#1C1C1C", // Deep Charcoal (primary button)
    colorAccent: "#7E8F83", // Muted Sage (calm accent)
    colorBg: "#F4F1EC", // Warm Ivory (page background)
    theme: "light" as "light" | "dark",
  },

  // Shared UI microcopy (loading states, errors). Lifted out of components
  // so nothing user-facing is hardcoded in JSX.
  ui: {
    submitting: "Sending...",
    genericError: "Something went wrong. Please try again.",
    networkError: "Could not connect. Please try again.",
    rateLimited: "Too many requests. Please try again in a minute.",
    emailInvalid: "Please enter a valid email address.",
    emailDisposable: "Please use a permanent email address.",
  },

  // Step 1: Landing / opt-in (the maturity quiz replaces the form in P2).
  landing: {
    eyebrow: "Free RevOps maturity check",
    headline: "Score your RevOps setup.",
    headlineItalic: "See where revenue quietly leaks.",
    subhead:
      "Answer five quick questions and get an instant maturity score, plus a personalized read on the three fixes that move the needle first.",
    bullets: [
      "A clear score across five revenue-ops dimensions",
      "The gaps costing you pipeline, ranked",
      "What to fix first, specific to your setup",
    ],
    cta: "Get my score",
    formLabel: "Your best email",
    socialProof: "Free. About a minute. No pitch.",
    previewCard: {
      label: "Sample result",
      score: "72",
      scoreUnit: "/ 100",
      title: "RevOps maturity score",
      lines: [
        "Five dimensions: data, pipeline, automation, reporting, stack",
        "A personalized report, not a generic PDF",
        "Built by a RevOps engineer, not a marketer",
      ],
    },
  },

  // Step 1b: RevOps maturity quiz (the lead magnet). Scored by lib/scoring.ts.
  quiz: {
    intro: {
      startCta: "Start the check",
      note: "About 3 minutes. 12 questions. No account, no email required.",
    },

    cohort: [
      {
        id: "headcount",
        label: "How many people work at your company?",
        options: [
          { id: "1_9", label: "1 to 9" },
          { id: "10_49", label: "10 to 49" },
          { id: "50_249", label: "50 to 249" },
          { id: "250_plus", label: "250 or more" },
        ],
      },
      {
        id: "motion",
        label: "How do most deals start?",
        options: [
          { id: "inbound", label: "Inbound led" },
          { id: "outbound", label: "Outbound led" },
          { id: "mixed", label: "A mix of both" },
          { id: "plg", label: "Product led" },
        ],
      },
    ],

    dimensions: [
      { id: "data", label: "Data hygiene", weight: 25, effort: 3 },
      { id: "pipeline", label: "Pipeline process", weight: 20, effort: 2 },
      { id: "reporting", label: "Reporting and attribution", weight: 20, effort: 2 },
      { id: "automation", label: "Automation and handoffs", weight: 15, effort: 2 },
      { id: "stack", label: "Tech stack", weight: 10, effort: 3 },
      { id: "ai", label: "AI readiness", weight: 10, effort: 1 },
    ],

    questions: [
      {
        id: "q_data_records",
        dimension: "data",
        prompt: "When a rep opens a company record, what do they usually find?",
        rationale: "This surfaces data quality problems faster than any audit.",
        options: [
          { id: "a", label: "Duplicates, or fields that contradict each other", score: 0 },
          { id: "b", label: "Core fields present, much of it stale or blank", score: 33 },
          { id: "c", label: "Reliable for the fields we actually use", score: 67 },
          { id: "d", label: "Complete and current, audited on a schedule", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_data_audit",
        dimension: "data",
        prompt: "When did you last run a deduplication or data audit?",
        options: [
          { id: "a", label: "Never done a formal one", score: 0 },
          { id: "b", label: "Once, at some point", score: 33 },
          { id: "c", label: "Ad hoc, when something breaks", score: 67 },
          { id: "d", label: "On a schedule, with a named owner", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_pipeline_criteria",
        dimension: "pipeline",
        prompt: "What has to be true for a deal to move to the next stage?",
        options: [
          { id: "a", label: "It depends who you ask", score: 0 },
          { id: "b", label: "Stages are written down, nobody enforces them", score: 33 },
          { id: "c", label: "Clear criteria, followed most of the time", score: 67 },
          { id: "d", label: "Defined exit criteria, enforced in the CRM", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_pipeline_forecast",
        dimension: "pipeline",
        prompt: "How far off was your last quarter's forecast?",
        rationale: "Not whether a forecast exists, whether it was right.",
        options: [
          { id: "a", label: "We do not forecast formally", score: 0 },
          { id: "b", label: "More than 25% out", score: 33 },
          { id: "c", label: "Within 25%", score: 67 },
          { id: "d", label: "Within 10%", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_reporting_channels",
        dimension: "reporting",
        prompt: "Can you name which channel produced your last 10 closed-won deals?",
        options: [
          { id: "a", label: "No", score: 0 },
          { id: "b", label: "Roughly, from memory or manual digging", score: 33 },
          { id: "c", label: "Yes for most, from a dashboard", score: 67 },
          { id: "d", label: "Yes end to end, including multi-touch", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_reporting_speed",
        dimension: "reporting",
        prompt: "Someone asks why you missed or hit last month. How long to answer with data?",
        options: [
          { id: "a", label: "We debate it, we do not resolve it", score: 0 },
          { id: "b", label: "Days of manual work", score: 33 },
          { id: "c", label: "Hours", score: 67 },
          { id: "d", label: "It is already on a dashboard", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        // Option ids MUST be the RESPONSE_BUCKETS ids from lib/benchmarks.ts.
        // lib/contradictions.ts compares this answer directly against the
        // numbers block's responseBucket, so the two id sets have to match.
        id: "q_automation_speed",
        dimension: "automation",
        prompt: "How long does a new inbound lead wait for first human contact?",
        rationale: "The most direct lever in revenue operations.",
        options: [
          { id: "over_day", label: "More than a day", score: 0 },
          { id: "same_day", label: "Same day", score: 33 },
          { id: "under_hour", label: "Within an hour", score: 67 },
          { id: "under_5min", label: "Under 5 minutes", score: 100 },
          { id: "x", label: "We do not measure it", score: 0, unknown: true },
        ],
      },
      {
        id: "q_automation_handoff",
        dimension: "automation",
        prompt: "What happens between \"demo booked\" and \"deal created\"?",
        options: [
          { id: "a", label: "Manual, someone retypes things", score: 0 },
          { id: "b", label: "Partly automated, with manual cleanup", score: 33 },
          { id: "c", label: "Automated, occasional silent failures", score: 67 },
          { id: "d", label: "Automated, monitored, alerts on failure", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_stack_tools",
        dimension: "stack",
        prompt: "How many tools touch your revenue data, and do they agree?",
        options: [
          { id: "a", label: "Many, and they disagree", score: 0 },
          { id: "b", label: "A few, syncing is patchy", score: 33 },
          { id: "c", label: "Integrated, mostly consistent", score: 67 },
          { id: "d", label: "Lean and consistent, one source of truth", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_stack_adoption",
        dimension: "stack",
        prompt: "What share of the revenue team uses the CRM daily as intended?",
        options: [
          { id: "a", label: "A minority", score: 0 },
          { id: "b", label: "About half", score: 33 },
          { id: "c", label: "Most", score: 67 },
          { id: "d", label: "Everyone, it is how work happens", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_ai_knowledge",
        dimension: "ai",
        prompt: "Where does your team's institutional knowledge live?",
        options: [
          { id: "a", label: "In people's heads", score: 0 },
          { id: "b", label: "Scattered docs, mostly outdated", score: 33 },
          { id: "c", label: "Documented and findable, partly current", score: 67 },
          { id: "d", label: "Documented, current, already feeding a tool", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
      {
        id: "q_ai_attempts",
        dimension: "ai",
        prompt: "Have you tried to automate or AI-assist a revenue workflow?",
        options: [
          { id: "a", label: "No", score: 0 },
          { id: "b", label: "Tried, it did not stick", score: 33 },
          { id: "c", label: "One or two live, unmonitored", score: 67 },
          { id: "d", label: "Several live, measured, owned", score: 100 },
          { id: "x", label: "Not sure", score: 0, unknown: true },
        ],
      },
    ],

    numbers: {
      title: "Optional: put a number on it",
      note: "Skip this and you still get the full diagnosis. Fill it in and the report prices the gap in euros. Nothing is sent anywhere.",
      skipCta: "Skip, show my results",
      submitCta: "Price the gap",
      fields: [
        { id: "acv", label: "Average contract value", unit: "EUR", type: "number" },
        { id: "winRate", label: "Win rate", unit: "%", type: "number" },
        { id: "inboundPerMonth", label: "New inbound leads per month", unit: "", type: "number" },
        { id: "responseBucket", label: "Median time to first contact", unit: "", type: "select" },
        { id: "headcount", label: "People on the revenue team", unit: "", type: "number" },
      ],
    },

    bands: [
      {
        min: 0,
        max: 34,
        label: "Held together by people",
        teaser: "It works because individuals compensate. It does not survive them leaving.",
      },
      {
        min: 35,
        max: 59,
        label: "Works until it doesn't",
        teaser: "Fine at today's volume. It breaks when you add reps or spend.",
      },
      {
        min: 60,
        max: 79,
        label: "Predictable",
        teaser: "You can forecast it and defend decisions from it.",
      },
      {
        min: 80,
        max: 100,
        label: "Compounding",
        teaser: "The system makes next quarter easier, not harder.",
      },
    ],

    report: { maxTokens: 2000 },
  },

  // Step 2: Resource (repurposed as the personalized report in P4).
  resource: {
    eyebrow: "Your report is ready",
    title: "Your RevOps maturity report",
    description:
      "Here is where your setup stands and what to fix first. A copy is on its way to your inbox.",
    ctaToBooking: "Book a 25-min call",
    ctaHeadline: "Prefer a second pair of eyes?",
    ctaSubhead:
      "Optional: book a short call and we will map the fastest wins together. No pitch.",
  },

  // Step 3: Book (Cal.com).
  booking: {
    eyebrow: "Last step",
    headline: "Book your call",
    description:
      "Pick a time that works. We will look at your score together and map the fastest wins.",
    calUsername: "balducci", // Cal.com handle
    calEventSlug: "25-min-chat-linkedin", // 25-min chat event
  },

  // Step 4: Thanks.
  thankyou: {
    eyebrow: "Confirmed",
    headline: "Your call is booked.",
    body: "You will get a confirmation email shortly. Talk soon.",
    nextStepsTitle: "Next steps",
    nextSteps: [
      "Add the meeting to your calendar",
      "Bring the one number you most want to move",
      "Keep an eye on your inbox",
    ],
  },

  legal: {
    companyName: "SiSu RevOps",
    contactEmail: "andrea@sisurevops.com",
    privacyUrl: "/privacy",
  },
} as const;

export default config;
