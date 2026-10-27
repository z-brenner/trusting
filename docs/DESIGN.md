# Design system

Trusting has two surfaces that share one design language:

1. **The builder** (admin): a calm, guided workspace. It should feel like a modern onboarding
   wizard, not a compliance console.
2. **The public Trust Center**: a credible, premium security portal that borrows the organisation's
   brand colour but stays restrained.

## Principles

- Warm-neutral canvas, white surfaces, hairline borders; charcoal (`#17171a`) type; one accent.
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
| `canvas` | `#f7f7f5` | Page background |
| `surface` / `surface-muted` | `#ffffff` / `#fafaf9` | Cards, panels, inputs / table heads, row hover |
| `line` / `line-strong` | `#e8e8e4` / `#d3d3cd` | Hairline borders on cards and rows / control borders |
| `ink` / `ink-muted` / `ink-faint` | `#17171a` / `#5d5e66` / `#8f9099` | Text hierarchy |
| `accent` | `#2a52be` | Admin primary buttons, selection tint |
| `success` / `warning` / `danger` / `info` / `teal` | see CSS | Status |
| `--brand`, `--brand-2` | per organisation | Public Trust Center header, badges, links |

Typography: three self-hosted voices (no external font requests). Geist (`font-sans`) for interface
and body, Instrument Serif via `.font-display` for display headings, Geist Mono (`font-mono`) for
small meta labels. `.eyebrow` = 11px mono, uppercase, tracked, `ink-faint`.

| Role | Size / weight |
| --- | --- |
| Display (public hero) | 32–40px serif / 400 |
| Admin page title (`h1`) | 30px serif / 400 (wizard step title 32px) |
| Section title (`h2`) | 16px / 600 |
| Card title (`h3`) | `.eyebrow` in `ink-muted` |
| Table header / small labels | `.eyebrow` |
| Body | 14–15px / 400, line-height 1.55 |
| Small / meta | 13px / 400, `ink-muted`; timestamps 11–12px mono |
| Stat numbers (dashboard) | 28px serif |

Radii: 8px controls and inputs, 12px cards and list panels, 18px dialogs and the preview frame.
Control heights: 32px (`sm`), 36px (`md`), 44px (`lg`). Cards have no shadow, only a hairline;
`xs` on buttons/inputs, `md` on popovers, `lg` on dialogs. Never on text. Focus: the global 2px
`accent-ring` outline, offset 2px.

## Components (`src/components/ui`)

`Button` (primary, secondary, ghost, danger; sm/md), `Input`, `Textarea`, `Select`, `Checkbox`,
`Switch`, `Field` (label + help + error), `Card`, `Badge` (neutral, success, warning, danger, info, teal),
`Alert`, `EmptyState`, `Dialog` (native `<dialog>`), `Spinner`, `StatusPill`.

## Admin chrome

- Top bar: 52px, white, hairline bottom border. Wordmark is a small black rounded square with the
  shield plus "Trust Center" in semibold. Nav items are quiet 13px text; the active item carries a
  2px `ink` underline (never the accent). Right side: "View site", muted user name, ghost sign-out.
- Page header: serif `h1` at 30px, muted sans description below, 32px bottom rhythm.
- Tables and lists: `.eyebrow` header row on `surface-muted`, 48–56px rows, hairline dividers,
  `surface-muted` on hover. Badges carry status; rows never use colour otherwise.
- Dashboard status panel: status dot + "Published · Version N · date", public URL in a mono pill
  with Copy/Open; action row on the right (secondary Edit/Preview, primary Update, ghost Unpublish).

## Builder layout

- Left rail (224px): 6 steps as small mono-numbered circles ("01"…"06"); the current step is filled
  `ink`, done steps show a check, a hairline connects them. Collapses to a compact horizontal stepper
  on mobile.
- Main column: `.eyebrow` "Step N of 6", serif step title at 32px, one topic per step, max-width
  720px for forms. Form sections are 40px apart and separated by hairlines (`StepBody`).
- Right column (xl screens): live preview in a thin device-like frame with a mono
  "Live preview · Draft" label, in an iframe refreshed after autosave.
- Vendor directory / framework catalog: hairline rows, hover `surface-muted`, selected rows tinted
  with `accent-soft`.
- Dialogs: 18px radius, hairline header, muted footer band.
- Autosave: debounced 800 ms, shown as a tiny dot plus mono "Saved" / "Saving…" / "Could not save".
  No modal interruptions.

## Public layout

- Header band in `--brand` with logo and title; body on `canvas`.
- Sections in this order: introduction, compliance, subprocessors + map, documents, contacts,
  certifications. Each section has an anchor, a title and a one-line description.
- Document rows: icon, title, category, last updated, action (Open / Request access / Lock).
- Map: muted world map; highlighted countries in `--brand` at 30–80 % opacity; clicking a country
  lists its subprocessors beneath the map.
