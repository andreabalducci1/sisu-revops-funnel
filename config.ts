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

const config = {
  business: {
    name: "SiSu RevOps",
    tagline: "Fractional RevOps and AI, wired into your revenue engine.",
    domain: "sisurevops.com",
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
      note: "About 60 seconds. 5 questions. No account.",
    },
    dimensions: [
      { id: "data", label: "Data hygiene", weight: 0.2 },
      { id: "pipeline", label: "Pipeline process", weight: 0.2 },
      { id: "automation", label: "Automation and handoffs", weight: 0.2 },
      { id: "reporting", label: "Reporting and attribution", weight: 0.2 },
      { id: "stack", label: "Tech stack", weight: 0.2 },
    ],
    questions: [
      {
        id: "q_data",
        dimension: "data",
        prompt: "How much do you trust what your CRM tells you?",
        options: [
          { id: "a", label: "It is a mess, nobody trusts it", score: 0 },
          { id: "b", label: "Usable, but stale in places", score: 33 },
          { id: "c", label: "Mostly clean, a few known gaps", score: 66 },
          { id: "d", label: "It is our single source of truth", score: 100 },
        ],
      },
      {
        id: "q_pipeline",
        dimension: "pipeline",
        prompt: "How consistent is the way deals move through your pipeline?",
        options: [
          { id: "a", label: "Every rep does it their own way", score: 0 },
          { id: "b", label: "Stages exist, but exit criteria are fuzzy", score: 33 },
          { id: "c", label: "Clear stages, mostly followed", score: 66 },
          { id: "d", label: "Defined stages with enforced exit criteria", score: 100 },
        ],
      },
      {
        id: "q_automation",
        dimension: "automation",
        prompt: "How much of your revenue busywork is automated?",
        options: [
          { id: "a", label: "Almost everything is manual", score: 0 },
          { id: "b", label: "A few Zaps held together with tape", score: 33 },
          { id: "c", label: "Core handoffs are automated", score: 66 },
          { id: "d", label: "Automated, monitored, and documented", score: 100 },
        ],
      },
      {
        id: "q_reporting",
        dimension: "reporting",
        prompt: "Can you see where revenue actually comes from?",
        options: [
          { id: "a", label: "We mostly guess", score: 0 },
          { id: "b", label: "Basic dashboards, no attribution", score: 33 },
          { id: "c", label: "Decent reporting, some attribution", score: 66 },
          { id: "d", label: "Clear attribution end to end", score: 100 },
        ],
      },
      {
        id: "q_stack",
        dimension: "stack",
        prompt: "How well does your tool stack actually fit together?",
        options: [
          { id: "a", label: "Tool sprawl, low adoption", score: 0 },
          { id: "b", label: "The tools exist, integrations are patchy", score: 33 },
          { id: "c", label: "Mostly integrated, decent adoption", score: 66 },
          { id: "d", label: "Lean, integrated, well adopted", score: 100 },
        ],
      },
    ],
    bands: [
      { min: 0, max: 39, label: "Foundational", teaser: "There is real money leaking here. The good news: these fixes are well understood and fast to ship." },
      { min: 40, max: 69, label: "Developing", teaser: "The basics are in place, but a few gaps are quietly costing you pipeline. Worth fixing before you scale spend." },
      { min: 70, max: 89, label: "Operational", teaser: "A solid setup. The upside now is in the details: attribution, automation, and adoption." },
      { min: 90, max: 100, label: "Optimized", teaser: "You run a tight revenue engine. The remaining gains are marginal, but they compound." },
    ],
    gate: {
      revealDimensionId: "data",
      unlockHeadline: "Your full report is ready",
      unlockSubhead: "See your score on all five dimensions and the three fixes to make first.",
      unlockCta: "Unlock my full report",
      lockedLabel: "Locked",
      fields: { firstName: true, company: true },
    },
    report: { maxTokens: 1200 },
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
