import { NextRequest } from "next/server";
import { optinSchema } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import {
  createLead,
  findLeadByEmail,
  updateLead,
  isAirtableConfigured,
  type LeadFields,
} from "@/lib/airtable";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { scoreQuiz, type ScoreResult } from "@/lib/scoring";
import config from "@/config";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

/** Map dimension ids to their Airtable score columns. */
function scoreFields(score: ScoreResult): Partial<LeadFields> {
  const byId = (id: string) => score.dimensions.find((d) => d.id === id)?.score;
  return {
    "Maturity Score": score.overall,
    "Maturity Band": score.band,
    "Score Data Hygiene": byId("data"),
    "Score Pipeline": byId("pipeline"),
    "Score Automation": byId("automation"),
    "Score Reporting": byId("reporting"),
    "Score Stack": byId("stack"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const { allowed } = checkRateLimit(`lead:${ip}`, RATE_LIMIT);
    if (!allowed) {
      return errors.tooManyRequests(config.ui.rateLimited);
    }

    const body = await req.json();
    const parsed = optinSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errors.badRequest(firstError?.message || config.ui.genericError);
    }

    const { email, firstName, company, answers, utmSource, utmMedium, utmCampaign } = parsed.data;

    // Recompute the score server-side; never trust a client-sent number.
    const score = answers ? scoreQuiz(answers, config.quiz) : null;

    // Demo mode: no Airtable -> accept the lead anyway.
    if (!isAirtableConfigured()) {
      console.log(
        "[lead] demo mode (Airtable not configured):",
        email,
        score ? `score=${score.overall} (${score.band})` : ""
      );
      return success({ id: `demo_${Date.now()}`, demo: true }, 201);
    }

    const extra: Partial<LeadFields> = {
      ...(company && { Company: company }),
      ...(answers && { "Quiz Answers": JSON.stringify(answers) }),
      ...(score && scoreFields(score)),
      ...(utmSource && { "UTM Source": utmSource }),
      ...(utmMedium && { "UTM Medium": utmMedium }),
      ...(utmCampaign && { "UTM Campaign": utmCampaign }),
    };

    const existing = await findLeadByEmail(email);
    if (existing) {
      const updated = await updateLead(existing.id, {
        ...(firstName && { Prenom: firstName }),
        Statut: "optin",
        ...extra,
      });
      return success({ id: updated.id });
    }

    const record = await createLead({
      Email: email,
      ...(firstName && { Prenom: firstName }),
      Statut: "optin",
      Source: "Funnel",
      ...extra,
    });

    return success({ id: record.id }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/lead] error:", message);
    return errors.internal(config.ui.genericError);
  }
}
