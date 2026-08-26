/**
 * French config for check.sisurevops.com — DRAFT, PENDING ANDREA'S REVIEW.
 *
 * Why this exists: 56 leads are held on `language_fr_nl` in the outbound
 * pipeline and cannot be contacted, because a French email that links to an
 * English quiz is exactly the small mismatch that makes outreach read as
 * automated. docs/copy-fr-2026-08-13.md in the outbound repo dropped the quiz
 * from the French sequence for that reason. This puts it back.
 *
 * Vouvoiement throughout. Plain register, no marketing hype, matching the
 * English tone rather than translating it word for word.
 *
 * Structure is inherited from the English config via localize(): question ids,
 * option ids, scores, dimension weights and band boundaries are never retyped
 * here, so a translation can never change what a score means.
 */
import en from "./config";
import { localize, type Translation } from "./lib/translate";

const fr: Translation = {
  landing: {
    eyebrow: "Diagnostic RevOps gratuit",
    headline: "Évaluez votre dispositif RevOps.",
    headlineItalic: "Voyez où le revenu fuit sans bruit.",
    subhead:
      "Répondez à 12 questions (environ trois minutes) et obtenez un score de maturité immédiat, avec une lecture personnalisée des trois correctifs qui comptent en premier.",
    bullets: [
      "Un score clair sur six dimensions du revenue ops",
      "Les failles qui vous coûtent du pipeline, classées",
      "Quoi corriger en premier, selon votre dispositif",
    ],
    cta: "Obtenir mon score",
    formLabel: "Votre meilleure adresse e-mail",
    socialProof: "Gratuit. Environ 3 minutes. Sans argumentaire.",
    previewCard: {
      label: "Exemple de résultat",
      score: "72",
      scoreUnit: "/ 100",
      title: "Score de maturité RevOps",
      lines: [
        "Six dimensions : données, pipeline, reporting, automatisation, stack, préparation à l'IA",
        "Un rapport personnalisé, pas un PDF générique",
        "Conçu par un ingénieur RevOps, pas par un marketeur",
      ],
    },
  },
  ui: {
    submitting: "Envoi...",
    genericError: "Une erreur est survenue. Merci de réessayer.",
    networkError: "Connexion impossible. Merci de réessayer.",
    rateLimited: "Trop de tentatives. Merci de réessayer dans une minute.",
    emailInvalid: "Merci d'indiquer une adresse e-mail valide.",
    emailDisposable: "Merci d'utiliser une adresse e-mail permanente.",
  },
  intro: {
    startCta: "Commencer le diagnostic",
    note: "Environ 3 minutes. 12 questions. Sans compte ni adresse e-mail.",
  },
  calibration: { eyebrow: "Calibrage rapide" },
  numbers: {
    eyebrow: "Dernière étape",
    title: "Facultatif : mettez un chiffre dessus",
    note: "Passez cette étape et vous obtenez quand même le diagnostic complet. Remplissez-la et le rapport chiffre l'écart en euros. Rien n'est envoyé nulle part.",
    skipCta: "Passer, voir mes résultats",
    submitCta: "Chiffrer l'écart",
    fields: {
      acv: { label: "Valeur moyenne d'un contrat" },
      winRate: { label: "Taux de conversion" },
      inboundPerMonth: { label: "Nouveaux leads entrants par mois" },
      responseBucket: {
        label: "Délai médian avant le premier contact",
        placeholder: "Je ne sais pas",
      },
      headcount: { label: "Personnes dans l'équipe revenue" },
    },
  },
  cohort: {
    headcount: {
      label: "Combien de personnes travaillent dans votre entreprise ?",
      options: {
        "1_9": "1 à 9",
        "10_49": "10 à 49",
        "50_249": "50 à 249",
        "250_plus": "250 ou plus",
      },
    },
    motion: {
      label: "Comment démarrent la plupart de vos affaires ?",
      options: {
        inbound: "Surtout en inbound",
        outbound: "Surtout en outbound",
        mixed: "Un mélange des deux",
        plg: "Par le produit",
      },
    },
  },
  dimensions: {
    data: "Qualité des données",
    pipeline: "Processus de pipeline",
    reporting: "Reporting et attribution",
    automation: "Automatisation et passages de relais",
    stack: "Stack technique",
    ai: "Préparation à l'IA",
  },
  bands: [
    {
      label: "Tenu à bout de bras",
      teaser:
        "Ça tient parce que les personnes compensent. Ça ne survit pas à leur départ.",
    },
    {
      label: "Ça marche jusqu'au jour où",
      teaser:
        "Correct au volume actuel. Ça casse dès que vous ajoutez des commerciaux ou du budget.",
    },
    {
      label: "Prévisible",
      teaser: "Vous pouvez prévoir, et défendre vos décisions avec.",
    },
    {
      label: "Cumulatif",
      teaser: "Le système rend le trimestre suivant plus facile, pas plus dur.",
    },
  ],
  questions: {
    q_data_records: {
      prompt: "Quand un commercial ouvre une fiche entreprise, qu'y trouve-t-il en général ?",
      rationale:
        "C'est ce qui révèle les problèmes de qualité des données plus vite que n'importe quel audit.",
      options: {
        a: "Des doublons, ou des champs qui se contredisent",
        b: "Les champs clés présents, beaucoup obsolètes ou vides",
        c: "Fiable pour les champs qu'on utilise vraiment",
        d: "Complet et à jour, audité régulièrement",
        x: "Je ne sais pas",
      },
    },
    q_data_audit: {
      prompt: "À quand remonte votre dernier dédoublonnage ou audit de données ?",
      options: {
        a: "Jamais fait de façon formelle",
        b: "Une fois, à un moment",
        c: "Au cas par cas, quand quelque chose casse",
        d: "À intervalle régulier, avec un responsable désigné",
        x: "Je ne sais pas",
      },
    },
    q_pipeline_criteria: {
      prompt: "Que faut-il pour qu'une affaire passe à l'étape suivante ?",
      options: {
        a: "Ça dépend à qui vous demandez",
        b: "Les étapes sont écrites, personne ne les applique",
        c: "Des critères clairs, respectés la plupart du temps",
        d: "Des critères de sortie définis, appliqués dans le CRM",
        x: "Je ne sais pas",
      },
    },
    q_pipeline_forecast: {
      prompt: "De combien votre prévision du dernier trimestre s'est-elle écartée ?",
      rationale: "Pas de savoir si une prévision existe, mais si elle était juste.",
      options: {
        a: "Nous ne faisons pas de prévision formelle",
        b: "Plus de 25 % d'écart",
        c: "Moins de 25 % d'écart",
        d: "Moins de 10 % d'écart",
        x: "Je ne sais pas",
      },
    },
    q_reporting_channels: {
      prompt: "Pouvez-vous dire quel canal a produit vos 10 dernières affaires gagnées ?",
      options: {
        a: "Non",
        b: "À peu près, de mémoire ou en fouillant à la main",
        c: "Oui pour la plupart, depuis un tableau de bord",
        d: "Oui de bout en bout, multi-touch compris",
        x: "Je ne sais pas",
      },
    },
    q_reporting_speed: {
      prompt:
        "On vous demande pourquoi le mois dernier a été manqué ou réussi. Combien de temps pour répondre avec des données ?",
      options: {
        a: "On en débat, on ne tranche pas",
        b: "Des jours de travail manuel",
        c: "Des heures",
        d: "C'est déjà sur un tableau de bord",
        x: "Je ne sais pas",
      },
    },
    q_automation_speed: {
      prompt: "Combien de temps un nouveau lead entrant attend-il un premier contact humain ?",
      rationale: "Le levier le plus direct en revenue operations.",
      options: {
        over_day: "Plus d'une journée",
        same_day: "Le jour même",
        under_hour: "Moins d'une heure",
        under_5min: "Moins de 5 minutes",
        x: "Nous ne le mesurons pas",
      },
    },
    q_automation_handoff: {
      prompt: "Que se passe-t-il entre « démo réservée » et « affaire créée » ?",
      options: {
        a: "Manuel, quelqu'un ressaisit les informations",
        b: "En partie automatisé, avec reprise manuelle",
        c: "Automatisé, avec des échecs silencieux occasionnels",
        d: "Automatisé, supervisé, avec alertes en cas d'échec",
        x: "Je ne sais pas",
      },
    },
    q_stack_tools: {
      prompt: "Combien d'outils touchent vos données de revenu, et sont-ils d'accord entre eux ?",
      options: {
        a: "Beaucoup, et ils se contredisent",
        b: "Quelques-uns, la synchronisation est inégale",
        c: "Intégrés, globalement cohérents",
        d: "Peu nombreux et cohérents, une seule source de vérité",
        x: "Je ne sais pas",
      },
    },
    q_stack_adoption: {
      prompt: "Quelle part de l'équipe revenue utilise le CRM au quotidien comme prévu ?",
      options: {
        a: "Une minorité",
        b: "Environ la moitié",
        c: "La plupart",
        d: "Tout le monde, c'est comme ça que le travail se fait",
        x: "Je ne sais pas",
      },
    },
    q_ai_knowledge: {
      prompt: "Où vit le savoir interne de votre équipe ?",
      options: {
        a: "Dans la tête des gens",
        b: "Des documents éparpillés, souvent obsolètes",
        c: "Documenté et trouvable, en partie à jour",
        d: "Documenté, à jour, et déjà exploité par un outil",
        x: "Je ne sais pas",
      },
    },
    q_ai_attempts: {
      prompt: "Avez-vous déjà tenté d'automatiser ou d'assister par IA un processus de revenu ?",
      options: {
        a: "Non",
        b: "Essayé, ça n'a pas tenu",
        c: "Un ou deux en production, sans supervision",
        d: "Plusieurs en production, mesurés, avec un responsable",
        x: "Je ne sais pas",
      },
    },
  },
};

export default localize(en, fr);
