---
description: Adjust the funnel's visual direction (colors, type, feel) while staying on the SiSu brand.
---
# Design, visual direction

Keep the funnel visually distinctive and on brand.

## Prerequisites
Read `memory/identity/brand.md` and `memory/identity/business.md`.
**Use the `frontend-design` skill** to aim for a memorable aesthetic and avoid generic
AI-looking output. The `sisu-revops-brand` skill carries Andrea's wider brand system.

## Current direction (already applied)

- **Background**: Warm Ivory `#f4f1ec`
- **Ink**: Deep Charcoal `#1c1c1c`
- **Accents**: Dusty Blue-Grey `#5a88b8`, Muted Sage
- **Display**: DM Serif Display. **Body**: DM Sans
- Editorial and calm, paper grain, soft radial wash behind the hero, one reveal animation

## Workflow

1. Confirm what is actually being changed and why. This brand is established, so treat
   changes as deliberate edits, not a fresh identity.
2. Apply changes in this order:
   - `config.ts > brand` (colorPrimary, colorAccent, colorBg, theme)
   - `app/globals.css` (CSS variables and their `-dark` / `-light` derivatives)
   - `app/layout.tsx` (fonts via `next/font/google`, `--font-display` / `--font-body`)
3. Update `memory/identity/brand.md`.
4. Run `/preview` and check it in the browser.

## Rules
- config.ts is the source of truth. No hardcoded color in components.
- Respect `prefers-reduced-motion`.
- Keep `.btn-primary`, `.surface-card`, `.reveal` consistent with the palette.
- Check contrast and the mobile rendering before calling it done.
