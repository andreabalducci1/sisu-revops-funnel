export type LeadStatut =
  | "optin"
  | "resource_viewed"
  | "booking"
  | "client"
  | "perdu";

export interface Lead {
  id: string;
  Email: string;
  Prenom?: string;
  Company?: string;
  Statut: LeadStatut;
  Source?: string;
  "Maturity Score"?: number;
  "Maturity Band"?: string;
  "Score Data Hygiene"?: number;
  "Score Pipeline"?: number;
  "Score Automation"?: number;
  "Score Reporting"?: number;
  "Score Stack"?: number;
  "Quiz Answers"?: string;
  Report?: string;
  "Report Generated At"?: string;
  "Report Emailed At"?: string;
  "UTM Source"?: string;
  "UTM Medium"?: string;
  "UTM Campaign"?: string;
  "Created At"?: string;
  Notes?: string;
}
