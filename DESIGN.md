---
name: SiSu RevOps Funnel
description: A calm consultant's diagnosis on good paper - warm ivory, charcoal ink, flat surfaces, editorial serif
colors:
  warm-ivory: "#f4f1ec"
  card-ivory: "#f8f6f1"
  soft-sand: "#e9e3d8"
  sand: "#e3dcd0"
  hairline: "#ddd6cb"
  deep-charcoal: "#1c1c1c"
  charcoal-hover: "#2a2a2a"
  soft-ink: "#474747"
  muted-sage: "#7e8f83"
  dusty-blue-grey: "#5a88b8"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    lineHeight: 1.7
  label:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  md: "8px"
spacing:
  grid: "8px"
  gutter: "1.5rem"
  container: "1100px"
components:
  button-primary:
    backgroundColor: "{colors.deep-charcoal}"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.md}"
    padding: "0.85rem 1.6rem"
  button-primary-hover:
    backgroundColor: "{colors.charcoal-hover}"
  button-outline:
    textColor: "{colors.deep-charcoal}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.4rem"
  card:
    backgroundColor: "{colors.card-ivory}"
    rounded: "{rounded.md}"
---

# Design System: SiSu RevOps Funnel

## Overview

**Creative North Star: "The Paper Diagnosis"**

Every surface in this funnel reads like a candid consultant's report printed on good paper. The ground is Warm Ivory, the ink is Deep Charcoal, and nothing shines: no shadows, no gradients, no glass. Authority comes from typography (an editorial serif for headlines, a plain humanist sans for everything else) and from restraint: color appears only where it carries meaning. The product is a diagnostic, and the design behaves like one: matte, precise, unhurried.

The system is derived from the SiSu RevOps brand (andreabalducci.com) and mirrors it exactly: same palette, same type pairing, same flat material. The funnel adds one product-specific obligation: the report page must survive being printed and forwarded, so print is a first-class surface, not an afterthought.

**Key Characteristics:**
- No pure white, no pure black; the whole world lives between ivory (#f4f1ec) and charcoal (#1c1c1c).
- Completely flat: zero drop shadows; depth is tonal (ivory, card, sand) plus hairline borders.
- One radius (8px) everywhere; no pills, no sharp corners.
- Serif display type in sentence case, with the italic counter-clause as the signature typographic move.
- Two accents only, used sparingly: Muted Sage for warmth and affirmation, Dusty Blue-Grey for eyebrows and prose links.
- One signature motion: a soft reveal-up on load; nothing bouncy, ever.

## Colors

A warm paper neutrals ramp carrying two quiet accents; charcoal ink does most of the talking.

### Primary
- **Deep Charcoal** (#1c1c1c): the ink. All text and the primary button fill. Hover state darkens to **Charcoal Hover** (#2a2a2a).
- **Soft Ink** (#474747): muted foreground for secondary copy and microcopy.

### Secondary
- **Muted Sage** (#7e8f83): the calm accent. Checkmarks, affirmative markers, small supporting highlights. Never a background for text blocks.
- **Dusty Blue-Grey** (#5a88b8): eyebrows/section labels and links inside prose. Nowhere else.

### Neutral
- **Warm Ivory** (#f4f1ec): default page background.
- **Card Ivory** (#f8f6f1): card and surface fill, a slight lift off the page.
- **Soft Sand** (#e9e3d8): soft section bands.
- **Sand** (#e3dcd0): chips and soft fills.
- **Hairline** (#ddd6cb): 1px borders and dividers.

### Named Rules
**The No Pure White Rule.** #ffffff and #000000 do not exist on screen. The lightest value is Card Ivory, the darkest is Deep Charcoal. The single exception is the print stylesheet, where the body goes white for paper.

**The Two Accents Rule.** Sage affirms, Dusty Blue labels and links. Neither ever exceeds a small fraction of a screen, and neither is a text color for body copy.

## Typography

**Display Font:** DM Serif Display (with Georgia fallback)
**Body Font:** DM Sans (with system-ui fallback)

**Character:** An editorial pairing: a high-contrast serif that reads like a magazine feature headline, grounded by a plain, friendly sans at a comfortable 17px/1.7 reading size.

### Hierarchy
- **Display / Headlines** (400, tight -0.02em tracking, 1.1 line-height): all h1-h4. DM Serif Display has no bold; emphasis inside headlines is italic, never weight.
- **Body** (400, 17px, 1.7): default copy, roughly 65ch max measure in prose blocks.
- **Eyebrow / Label** (500, 12px, +0.12em tracking, UPPERCASE): the only uppercase element, always Dusty Blue-Grey, sits one line above its heading.

### Named Rules
**The Italic Counter-Clause Rule.** Two-part headlines set the counter-clause in italic ("...without the chaos"). This is the brand's signature typographic move; new headlines should look for the opportunity.

**The Sentence Case Rule.** Headlines are sentence case. Never Title Case, never ALL CAPS (the 12px eyebrow is the sole uppercase voice).

## Layout

A single 1100px container (1.5rem side gutters) on an 8pt rhythm. The landing uses a two-column funnel grid (1.1fr content / 0.9fr aside, 3.5rem gap) that collapses to one column at 860px, with the aside moving first on mobile. Density is generous and editorial: sections breathe, copy stays near a 65ch measure. The report page must paginate cleanly in print: interactive furniture hides (`.no-print`), findings never split across a page break (`.print-keep`).

## Elevation & Depth

Completely flat. `--shadow-card` and `--shadow-lift` are literally `none` in the tokens. Depth is conveyed tonally (Warm Ivory page, Card Ivory surfaces, Sand bands) and by 1px Hairline borders.

### Named Rules
**The Flat Paper Rule.** No drop shadows, ever, in any state. If an element needs separation, it gets a tonal fill or a hairline border, not a shadow.

## Shapes

One corner language: 8px radius on every button, card, and input. No pill buttons, no fully-round chips, no sharp 0px corners. Borders are 1px Hairline for passive surfaces; the outline button uses a firmer 1.5px charcoal border. Decorative geometry stays paper-like (the `paper-grain` positioning context hosts soft background shapes, never patterns that imply texture or noise).

## Components

### Buttons
- **Character:** matte and confident; presence through contrast, not effects.
- **Shape:** gently rounded (8px), never a pill.
- **Primary:** Deep Charcoal fill with Warm Ivory text, 0.85rem x 1.6rem padding; hover darkens to Charcoal Hover over 0.18s ease; disabled drops to 0.55 opacity. On brand surfaces the primary CTA may add the swipe-overlay hover from the marketing site; the funnel keeps the simple darken.
- **Secondary (outline):** transparent with a 1.5px Deep Charcoal border; hover inverts to charcoal fill with ivory text.

### Cards / Containers
- **Corner style:** 8px radius.
- **Style:** Card Ivory fill, 1px Hairline border, no shadow (matte, paper-like).

### Eyebrow (SectionLabel)
- 12px, weight 500, uppercase, +0.12em tracking, Dusty Blue-Grey; always directly above its heading.

### Links
- Prose links are Dusty Blue-Grey. The signature treatment is the animated underline: a 1.5px currentColor bar that scales in from the left over 0.25s ease on hover.

### Motion
- **The One Reveal Rule.** One signature entrance: `reveal-up` (opacity 0, translateY 14px, to rest) over 0.6s with `cubic-bezier(0.22, 1, 0.36, 1)`, staggered ~0.11s between siblings. No bounce, no overshoot, no parallax. `prefers-reduced-motion` collapses everything to static.

## Do's and Don'ts

**Do:**
- Do keep every background ivory-family and every text charcoal-family.
- Do use italic (not weight) for emphasis in headlines.
- Do use the eyebrow + serif headline pattern to open sections.
- Do keep the report printable: test new report elements against the print stylesheet.
- Do write microcopy in the brand voice: problem-first, plain, radically candid, dot-separated qualifiers ("Free · No pitch").

**Don't:**
- Don't use drop shadows, gradients, glassmorphism, or pure white/black.
- Don't use purple-indigo AI-default palettes or emoji clusters.
- Don't use em or en dashes anywhere, including generated copy; restructure or use a single hyphen.
- Don't introduce new accent colors, new radii, or bouncy animation.
- Don't use the banned vocabulary: supercharge, unleash, game-changer, leverage, synergy, ecosystem, 10x.
