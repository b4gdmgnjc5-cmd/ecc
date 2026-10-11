---
name: awesome-design-md
description: Library of 74 ready-made DESIGN.md design systems (Stripe, Linear, Vercel, Apple, Notion, Figma, Supabase, Spotify, Tesla...) from VoltAgent/awesome-design-md. Use when the user wants a UI, landing page, or component "in the style of" a known product, asks for a DESIGN.md, or needs a coherent color/typography/spacing system to build against.
origin: community
---

# Awesome DESIGN.md

A vendored copy of [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT).
Each `designs/<brand>/DESIGN.md` is a plain-markdown design system in the Google Stitch DESIGN.md
format: YAML tokens (colors, typography, spacing, radii, shadows) followed by prose sections
(Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts,
Responsive Behavior, Iteration Guide).

## When to Use

- The user asks for a page or component "like Stripe", "Linear-style", "Apple vibe", etc.
- The user wants a `DESIGN.md` in their project root to keep AI-generated UI consistent.
- A frontend task has no design system and needs a coherent, opinionated one.
- Pairs well with `design-taste-frontend` (taste-skill) for execution quality and
  `web-design-guidelines` for a final review pass.

## How It Works

1. **Pick a design.** Read `INDEX.md` (one line per brand) and choose the closest match to the
   user's request. If the request is vague, propose 2-3 candidates with their one-line summary
   and let the user choose.
2. **Read the full file** `designs/<brand>/DESIGN.md` before writing any UI. The YAML tokens are
   the source of truth for values; the prose sections explain intent and constraints.
3. **Apply it.**
   - To persist it for the project, copy the file to the project root as `DESIGN.md`.
   - Map tokens to the stack in use: CSS custom properties, Tailwind `theme.extend`, or a
     theme object. Do not invent values the file does not define.
   - Follow the "Do's and Don'ts" and "Responsive Behavior" sections literally.
4. **Respect brands.** These files describe a visual language, not brand assets. Build original
   products *inspired by* the style; never reproduce another company's logo, name, or wording in
   a way that could pass as that company.

## Examples

```text
User: Build me a pricing page that feels like Linear.
-> Read INDEX.md, open designs/linear.app/DESIGN.md, use its near-black canvas, lavender
   accent and hairline-bordered cards, then build the page from those tokens.
```

```bash
# Persist a design system in the user's project
cp .claude/skills/awesome-design-md/designs/stripe/DESIGN.md ./DESIGN.md
```

```text
User: I need a clean design system for my SaaS dashboard, no specific brand.
-> Suggest 2-3 matches from INDEX.md (e.g. vercel, supabase, posthog) with their summaries,
   then apply the chosen one.
```
