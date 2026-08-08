# Brand direction

> Colors, type, visual tone. Mirrors config.ts > brand and app/globals.css.

## Colors

- **Background**: Warm Ivory, #f4f1ec
- **Ink**: Deep Charcoal, #1c1c1c
- **Accent (primary)**: Dusty Blue-Grey, #5a88b8
- **Accent (secondary)**: Muted Sage
- **Theme**: light

## Typography

- **Display**: DM Serif Display (editorial serif, used for headlines)
- **Body**: DM Sans

## Visual tone

Editorial and calm, paper-like. Generous whitespace, a soft radial wash behind the hero,
a subtle paper grain. One signature motion only (reveal on load). Respect
prefers-reduced-motion.

## Rules

- config.ts is the source of truth. No hardcoded color or copy in components.
- Keep utility classes (.btn-primary, .surface-card, .reveal) aligned with the palette.
- Check contrast and the mobile rendering after any change.
