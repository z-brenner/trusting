# Design system

Trusting has two surfaces that share one design language:

1. **The builder** (admin): a calm, guided workspace. It should feel like a modern onboarding
   wizard, not a compliance console.
2. **The public Trust Center**: a credible, premium security portal that borrows the organisation's
   brand colour but stays restrained.

## Principles

- White and soft neutral surfaces; charcoal (`#1c1c22`) type; one accent.
- Generous whitespace, tight vertical rhythm (4px grid, 8/12/16/24/32 spacing).
- Hierarchy through weight and size, not colour. Colour is reserved for status and actions.
- No gradients, no oversized cards, no decorative animation. Transitions are 120–200 ms and
  only for state changes (hover, open/close, autosave indicator).
- Every interactive element has a visible keyboard focus ring. Contrast is at least 4.5:1 for text.
- Honest status language: a framework badge always carries its status label
  ("Self-attested alignment", "Implementation in progress", ...). Nothing implies certification unless
  the administrator chose *Certified*.

## Tokens

Defined in `src/app/globals.css` with Tailwind 4 `@theme`.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#f6f6f7` | Page background |
| `surface` | `#ffffff` | Cards, panels, inputs |
| `line` / `line-strong` | `#e5e5ea` / `#cfcfd6` | Borders, dividers |
| `ink` / `ink-muted` / `ink-faint` | `#1c1c22` / `#5c5d66` / `#8a8b95` | Text hierarchy |
| `accent` | `#2b59c3` | Admin primary actions and links |
| `success` / `warning` / `danger` / `info` / `teal` | see CSS | Status |
| `--brand`, `--brand-2` | per organisation | Public Trust Center header, badges, links |

Typography: Inter Variable (self-hosted via `@fontsource-variable/inter`, no external font requests).

| Role | Size / weight |
| --- | --- |
| Display (public hero) | 32–40px / 600, tracking -0.02em |
| Page title | 24px / 600 |
| Section title | 18px / 600 |
| Body | 15px / 400, line-height 1.55 |
| Small / meta | 13px / 400, `ink-muted` |

Radii: 6px controls, 8px inputs/buttons, 12px cards, 16px large panels.
Shadows: `xs`/`sm` on cards, `md` on popovers, `lg` on dialogs. Never on text.

## Components (`src/components/ui`)

`Button` (primary, secondary, ghost, danger; sm/md), `Input`, `Textarea`, `Select`, `Checkbox`,
`Switch`, `Field` (label + help + error), `Card`, `Badge` (neutral, success, warning, danger, info, teal),
`Alert`, `EmptyState`, `Dialog` (native `<dialog>`), `Spinner`, `StatusPill`.

## Builder layout

- Left rail: 6 steps with state (done / current / upcoming), always visible on desktop, collapses to
  a top stepper on mobile.
- Main column: one topic per step, max-width 720px for forms, ample headings and helper text.
- Right column (xl screens): live preview of the public page, in an iframe refreshed after autosave.
- Autosave: debounced 800 ms, with a quiet "Saved" / "Saving…" / "Could not save" indicator. No
  modal interruptions.

## Public layout

- Header band in `--brand` with logo and title; body on `canvas`.
- Sections in this order: introduction, compliance, subprocessors + map, documents, contacts,
  certifications. Each section has an anchor, a title and a one-line description.
- Document rows: icon, title, category, last updated, action (Open / Request access / Lock).
- Map: muted world map; highlighted countries in `--brand` at 30–80 % opacity; clicking a country
  lists its subprocessors beneath the map.
