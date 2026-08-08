---
description: Manage the Airtable leads base. Inspect, filter, and update contacts captured by the funnel.
---
# CRM, lead management (Airtable)

Inspect and manage leads via the Airtable MCP.

## Prerequisites
Read `memory/funnel/config.md` for the Base ID and table name
(base `appFKYUcURrO7jMrf`, table `Leads`).

## Capabilities

- **View leads**: `mcp__airtable__list_records` on Leads (paginate when needed).
- **Filter**: by `Statut` (optin, booking, client, lost), by date, by source, by
  `Maturity Band`.
- **Quick stats**: count by status and by band, opt-in to booking rate, average
  `Maturity Score`.
- **Update**: change a status or add a note (`mcp__airtable__update_records`).

## Workflow

1. Ask what Andrea wants (view, filter, stats, update).
2. Run it through the Airtable MCP.
3. Print a readable table (first name, email, score, band, status, date).
4. Suggest a follow-up action.

## Rules
- Max 10 records per Airtable PATCH call.
- Confirm before any bulk update (more than 5 leads).
- Never expose the API key.
- Test leads from the build (addresses containing `claude-`) are safe to delete.
