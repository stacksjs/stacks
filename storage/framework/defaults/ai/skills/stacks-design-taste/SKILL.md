---
name: stacks-design-taste
description: Use when designing or building a landing page, portfolio, hero, marketing section, or redesign in a Stacks app, or when the ask is anti-slop / premium frontend work. Reads the brief, infers the right direction, and ships stx + Crosswind interfaces that do not look templated, with a strict pre-flight check.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Design Taste: Anti-Slop Frontend Skill

Related skills: [stacks-stx](../stacks-stx) (templating, directives, signals, SSR/hydration), [stacks-composables](../stacks-composables) (full composable reference), [stacks-crosswind](../stacks-crosswind) (utilities, dark mode, theming), [stacks-ui](../stacks-ui) (Craft native + headless components, Transition). Companions: [stacks-design-soft](../stacks-design-soft), [stacks-design-minimalist](../stacks-design-minimalist), [stacks-design-brutalist](../stacks-design-brutalist), [stacks-redesign](../stacks-redesign), [stacks-design-output](../stacks-design-output).

> Landing pages, portfolios, and redesigns in Stacks. Not dashboards, not data tables, not multi-step product UI (see Section 13).
> Every rule below is **contextual**. None of it fires automatically. First read the brief, then pull only what fits.
> Everything is built with **stx** templates + **Crosswind** utilities + **stx composables**. No JSX, no external motion library.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** - landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used - "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** - URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** - B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** - logo, color, type, photography. For redesigns, these are starting material, not optional input (see Section 11).
6. **Quiet constraints** - accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<aesthetic family> built on the Stacks stack."**

Example reads:
- *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Crosswind utilities + Geist + restrained CSS motion."*
- *"Reading this as: solo designer portfolio for hiring managers, with an editorial / kinetic-type language, leaning toward Crosswind + scroll-driven CSS animation + custom typography."*
- *"Reading this as: redesign of a trust-first service site, leaning toward high-contrast neutral system, accessibility-first, minimal motion."*

### 0.C If the brief is ambiguous, ask one question, do not guess
Ask exactly **one** clarifying question - never a multi-question dump - and only when the design read genuinely diverges. Example: *"Should this feel closer to Linear-clean or Awwwards-experimental?"*

If you can confidently infer from context, **do not ask**. Just declare the design read and proceed.

### 0.D Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision below is gated by these.

* **`DESIGN_VARIANCE: 8`** - 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** - 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** - 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them. Do not ask the user to edit this file - overrides happen conversationally.

### 1.A Dial Inference (design read -> dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

### 1.B Use-Case Presets
| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Landing (Agency / creative) | 9 | 8 | 3 |
| Landing (Premium consumer) | 7 | 6 | 3 |
| Portfolio (Designer / studio) | 8 | 7 | 3 |
| Portfolio (Developer) | 6 | 5 | 4 |
| Editorial / Blog | 6 | 4 | 3 |
| Public-sector service | 3 | 2 | 5 |
| Redesign - preserve | match | match+1 | match |
| Redesign - overhaul | +2 | +2 | match |

### 1.C How the Dials Drive Output
Use these (or user-overridden values) as global variables. Cross-references throughout this document refer to these exact variable names - never invent aliases like `LAYOUT_VARIANCE` or `ANIM_LEVEL`.

---

## 2. BRIEF -> FOUNDATION MAP

Once you have the design read (Section 0) and dials (Section 1), pick the right foundation. Do not invent CSS for things Stacks already ships. Do not pretend an aesthetic trend is an official system.

### 2.A The Stacks foundation (default for every Stacks app)
The React skill's "reach for Fluent / Carbon / Material / shadcn" advice does **not** apply in a Stacks app. Your foundation is always:

| Layer | What to use | Notes |
|---|---|---|
| Components | **Stacks UI** (`@stacksjs/ui`) | Headless primitives (Combobox, Dialog/Modal, Menu, Tabs, Switch, RadioGroup, Popover, Disclosure, Transition) plus **Craft native components** (`craft-button`, `craft-text-input`, `craft-textarea`, `craft-checkbox`, `craft-select`, `craft-modal`). See [stacks-ui](../stacks-ui). |
| Styling | **Crosswind** utilities | Tailwind-compatible syntax, `dark:` variant, arbitrary values. See [stacks-crosswind](../stacks-crosswind). |
| Icons | **Iconify** `i-{collection}-{name}` | hugeicons default. See Section 3.C. |
| Templating | **stx** SFC | `<script>` / `<template>` / `<style>`. See [stacks-stx](../stacks-stx). |

**Honesty rule (retargeted):** use the real official thing, do not hand-recreate tokens. In Stacks, the real official thing is **Stacks UI + Crosswind + Iconify**. Do NOT tell the user to `npm install` Fluent, Carbon, Material, Radix, or shadcn into a Stacks app. Do NOT hand-recreate a component that already exists in Stacks UI.

**One system per project = the Stacks stack.** External design systems are out of scope unless the user explicitly runs a separate non-Stacks frontend.

### 2.B When the brief is an aesthetic, not a system
Aesthetic directions have no package. Build them with **native CSS + Crosswind**. Be honest in code comments about what is borrowed inspiration vs. real material.

| Aesthetic | Honest implementation (Crosswind + native CSS) |
|---|---|
| Glassmorphism / "frosted glass" | `backdrop-filter`, layered borders, highlight overlays. Provide solid-fill fallback for `prefers-reduced-transparency`. See Appendix C. |
| Bento (Apple-style tile grids) | CSS Grid with mixed cell sizes (`grid grid-cols-*` + row/col spans). No library owns this. |
| Brutalism | Native CSS, monospace, raw borders. See [stacks-design-brutalist](../stacks-design-brutalist). |
| Editorial / magazine | Serif type, asymmetric grid, generous whitespace. No library. |
| Dark tech / hacker | Mono + accent, terminal motifs. No library. |
| Aurora / mesh gradients | SVG or layered radial gradients in a `<style>` block. No library. |
| Kinetic typography | Native CSS animations + CSS scroll-driven animations. No motion library (Section 5). |
| Soft / friendly consumer | Rounded scale, soft shadows. See [stacks-design-soft](../stacks-design-soft). |
| "Apple Liquid Glass" | Apple documents this for Apple platforms only. **There is no official web CSS package.** Web versions are approximations using `backdrop-filter` + layered borders + highlights. Label clearly as approximation (Appendix C). |

---

## 3. DEFAULT ARCHITECTURE & CONVENTIONS

Unless the design read pulls in an aesthetic-specific companion, these are the defaults.

### 3.A Stack
* **Templating:** **stx** SFC files (`.stx`) with three optional blocks: `<script>`, `<template>` (or bare markup), `<style>`. Pages/views in `resources/views/*.stx`, components in `resources/components/*.stx`, layouts in `resources/layouts/*.stx`.
  * **SERVER vs CLIENT split (the stx equivalent of RSC):** put data fetching, DB access, and secrets in `<script server>` (stripped from the client bundle). Put browser-only behavior (motion, pointer, scroll observers) in `<script client>`. A plain `<script>` runs on both. There is **no `'use client'`** directive - the block type IS the boundary.
  * **INTERACTIVITY ISOLATION:** any component that observes scroll, tracks the pointer, or runs CSS-driven motion keeps its interactive logic in a `<script client>` block. Server rendering stays static.
* **Styling:** **Crosswind** (Tailwind-compatible utilities). Scoped rules go in the `.stx` `<style>` block; tokens go in CSS custom properties. See [stacks-crosswind](../stacks-crosswind).
* **Motion:** CSS + composables ONLY. Stacks ships no animation library (Section 5). Never import `motion/react`, `framer-motion`, or `gsap`.
* **Fonts:** Stacks `fonts` config plus `<link rel="preconnect">` + stylesheet (or self-hosted `@font-face`) in the layout `.stx` `<head>`, always `font-display: swap`. There is **no `next/font`**. See Section 4.1.

**HARD BANS inside every stx `<script>` block:** never `var`, never `document.*`, never `window.*`. Use signals, composables, and directives instead (this is a CLAUDE.md rule, not a preference).

### 3.B State & Reactivity
* Local reactive state uses signals: `state(initial)` (read `count()`, write `count.set(v)` / `count.update(n => n + 1)`), `derived(() => ...)` for computed, `effect(() => ...)` for side effects. Element refs use `useRef('name')`.
* Translation from React if you are porting: `useState` -> `state`, `useMemo` -> `derived`, `useEffect` -> `effect`, `useRef` -> `useRef`.
* **NEVER drive continuous values (mouse position, scroll progress, pointer physics, magnetic hover) through a signal you re-read every frame.** Writing signal state on every pointer or scroll frame re-runs reactive effects and collapses on mobile. Instead drive a **CSS custom property** from inside an `effect` (Section 5.D) or let CSS scroll-driven animations do the work with no script at all.

### 3.C Icons
* **Use Iconify utility classes.** stx ships 200K+ Iconify icons as classes: `<i class="i-hugeicons-{name}"></i>`, or any collection `i-{collection}-{name}` (`i-ph-arrow-right`, `i-tabler-check`). Size and color with Crosswind: `class="i-hugeicons-book-open h-6 w-6 text-gray-500"`.
* **Default collection: hugeicons.** Keep **one collection per project**. Standardize stroke weight.
* **NEVER hand-roll SVG icon paths. NEVER `npm install lucide-react` / `@phosphor-icons/*` / any icon package.** The Iconify classes replace all of that. If a glyph is missing, pull it from another Iconify collection - do not draw paths from scratch.

### 3.D Emoji Policy
Discouraged by default in code, markup, and visible text. Replace symbols with Iconify glyphs. **Override:** allow emojis only when the user explicitly asks for a playful / chat-style / social-native vibe, and even then use them sparingly with intent.

### 3.E Responsiveness & Layout Mechanics
* Standardize breakpoints (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`).
* Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
* **Viewport Stability:** NEVER use `h-screen` for full-height hero sections. ALWAYS use `min-h-[100dvh]` to prevent layout jumping on mobile (iOS Safari address bar).
* **Grid over Flex-Math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). ALWAYS use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`).

### 3.F Dependency Verification (mandatory)
Before importing ANY 3rd-party library, check `package.json`. Most of what you need is already in the Stacks stack (Stacks UI, Crosswind, Iconify, composables) and needs no install. If you genuinely need a missing package, output the install command first. **Never** assume a library exists.

---

## 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

LLMs default to cliches. Override these defaults proactively. Each rule has a context-aware override path.

### 4.1 Typography
* **Display / Headlines:** Default `text-4xl md:text-6xl tracking-tighter leading-none`.
* **Body / Paragraphs:** Default `text-base text-gray-600 leading-relaxed max-w-[65ch]`.
* **Loading mechanism (Stacks):** declare font metadata in the Stacks `fonts` config, then load in the layout `.stx` `<head>` with `<link rel="preconnect">` + stylesheet, or self-host with `@font-face`. Always `font-display: swap`. There is no `next/font`. Never block render on a webfont.
* **Sans font choice:**
  * **Discouraged as default:** `Inter`. Pick `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`, or a brand-appropriate serif first.
  * **Override:** Inter is acceptable when the user explicitly asks for a neutral / standard / Linear-style feel, or when the brief is a public-sector / accessibility-first site.
* **Pairings to know:** `Geist` + `Geist Mono`, `Satoshi` + `JetBrains Mono`, `Cabinet Grotesk` + `Inter Tight`, `GT America` + `IBM Plex Mono`.

* **SERIF DISCIPLINE (VERY DISCOURAGED AS DEFAULT):**
  * Serif is **very discouraged as the default font for any project.** "It feels creative / premium / editorial" is NOT a reason to reach for serif. The agent's default mental model that "creative brief = serif" is the single most-tested AI tell in production rounds.
  * **Serif is only acceptable when ONE of these is explicitly true:**
    - The brand brief literally names a serif font, OR
    - The aesthetic family is genuinely editorial / luxury / publication / manuscript / heritage / vintage AND you can articulate why this specific serif fits this specific brand
  * For everything else (creative agency, design studio, modern brand, premium consumer, portfolio, lifestyle), **default sans-serif display** (Geist Display, ABC Diatype, Sohne Breit, Cabinet Grotesk Display, Migra Sans, GT Walsheim, Inter Display, PP Neue Montreal). Sans display fonts are not "boring", they are the default for the same reason black is the default in fashion.
  * **EMPHASIS RULE (related):** When you want to emphasize a word within a headline, use **italic or bold of the SAME font**. Do NOT inject a random serif word into a sans headline (or vice versa) just to add visual interest. Mixed-family emphasis is amateur. Italic/bold emphasis in the same family is the right move.
  * **Specifically BANNED as defaults:** `Fraunces` and `Instrument_Serif` (the two LLM-favorite display serifs).
  * **If a serif is justified** (rare, per the above), rotate from this pool, do NOT reuse the same serif across consecutive projects: PP Editorial New, GT Sectra Display, Cardinal Grotesque, Reckless Neue, Tiempos Headline, Recoleta, Cormorant Garamond, Playfair Display, EB Garamond, IvyPresto, Migra, Editorial Old, Saol Display, Domaine Display, Canela, Schnyder, Tobias, NB Architekt, ITC Galliard.

* **ITALIC DESCENDER CLEARANCE (mandatory):** When italic is used in display type and the word contains a descender letter (`y g j p q`), `leading-[1]` or `leading-none` will clip the descender. Use `leading-[1.1]` minimum and add `pb-1` or `mb-1` reserve on the wrapping element. Audit every italic word in display headlines before shipping.

### 4.2 Color Calibration
* Max 1 accent color. Saturation < 80% by default.
* **THE LILA RULE:** The "AI Purple / Blue glow" aesthetic is discouraged as a default. No automatic purple button glows, no random neon gradients. Use neutral bases (Zinc / Slate / Stone) with high-contrast singular accents (Emerald, Electric Blue, Deep Rose, Burnt Orange, etc.).
* **Override:** if the brand or brief explicitly asks for purple / violet / lila, embrace it. But execute with intent: consistent palette, harmonised neutrals, restrained gradients. Not generic AI gradient slop.
* **One palette per project.** Do not fluctuate between warm and cool grays within the same project.
* **COLOR CONSISTENCY LOCK (mandatory):** Once an accent color is chosen for a page, it is used on the WHOLE page. A warm-grey site does not suddenly get a blue CTA in section 7. A rose-accented site does not get a teal status badge in the footer. Pick one accent, lock it, audit every component before shipping.

* **PREMIUM-CONSUMER PALETTE BAN (mandatory, second-most-recurring AI-tell):**
  * For premium-consumer briefs (cookware, wellness, artisan, luxury, heritage craft, DTC home goods, etc.) the LLM default is **warm beige/cream + brass/clay/oxblood/ochre + espresso/ink dark text**. Concretely banned hex families as default backgrounds and accents:
    - Backgrounds: `#f5f1ea`, `#f7f5f1`, `#fbf8f1`, `#efeae0`, `#ece6db`, `#faf7f1`, `#e8dfcb` (all "warm paper / cream / chalk / bone")
    - Accents: `#b08947`, `#b6553a`, `#9a2436`, `#9c6e2a`, `#bc7c3a`, `#7d5621` (all "brass / clay / oxblood / ochre")
    - Text: `#1a1714`, `#1a1814`, `#1b1814` (all "espresso / warm near-black")
  * This palette is BANNED as the default reach for premium-consumer briefs. Every premium-consumer site you have ever shipped uses this exact palette. The brand becomes invisible.
  * **Default alternatives (rotate, do not reuse):**
    - **Cold Luxury:** silver-grey + chrome + smoke
    - **Forest:** deep green + bone + amber accent
    - **Black and Tan:** true off-black + warm tan, sharp contrast, no beige
    - **Cobalt + Cream:** saturated blue against a single neutral, no brass
    - **Terracotta + Slate:** warm rust against cool grey, no brass
    - **Olive + Brick + Paper:** muted olive plus brick-red accent
    - **Pure monochrome + single saturated pop:** off-white + off-black + one bright accent (electric blue, emerald, hot pink, etc.)
  * **Palette-rotation rule:** if the previous premium-consumer project you generated used the beige+brass family, this one MUST use a different family. Do not ship the same warm-craft palette twice in a row.
  * **Override:** the beige+brass+espresso palette is acceptable ONLY when the brand brief explicitly names those colors, or when the brand identity is genuinely vintage / artisan / warm-craft AND you can articulate why this specific palette fits this specific brand. Default-reaching for it because "this is a cookware brief" is banned.

### 4.3 Layout Diversification
* **ANTI-CENTER BIAS:** Centered hero / H1 sections are avoided when `DESIGN_VARIANCE > 4`. Force "Split Screen" (50/50), "Left-aligned content / right-aligned asset", "Asymmetric white-space", or scroll-pinned structures.
* **Override:** centered hero is OK for editorial / manifesto / launch-announcement briefs where the message itself is the design.

### 4.4 Materiality, Shadows, Cards
* Use cards ONLY when elevation communicates real hierarchy. Otherwise group with `border-t`, `divide-y`, or negative space.
* When a shadow is used, tint it to the background hue. No pure-black drop shadows on light backgrounds.
* For `VISUAL_DENSITY > 7`: generic card containers are banned. Data metrics breathe in plain layout.
* **SHAPE CONSISTENCY LOCK (mandatory):** Pick ONE corner-radius scale for the page and stick to it. Options: all-sharp (radius 0), all-soft (radius 12-16px), all-pill (full radius for interactive). Mixed systems are allowed only when there is a documented rule (e.g. "buttons are full-pill, cards are 16px, inputs are 8px") and that rule is followed everywhere. Round buttons in a square layout, or square cards on a pill-button page, is broken design.

### 4.5 Interactive UI States
LLMs default to "static successful state only." Always implement full cycles:
* **Loading:** Skeletal loaders matching the final layout's shape. Avoid generic circular spinners.
* **Empty States:** Beautifully composed; indicate how to populate.
* **Error States:** Clear, inline (forms), or contextual (use Stacks UI `Transition` for toasts, transient only).
* **Tactile Feedback:** On `:active`, use `active:-translate-y-[1px]` or `active:scale-[0.98]` to simulate a physical push.
* **BUTTON CONTRAST CHECK (mandatory, a11y):** Before shipping any button, verify the button text is readable against the button background. White button + white text, `bg-white` CTA with `text-white` label, transparent button against the page background with no border -> all banned. Audit every CTA: contrast ratio WCAG AA min (4.5:1 for body, 3:1 for large text 18px+). Same rule applies to ghost buttons over photographic backgrounds (use a backdrop, scrim, or stroke).
* **CTA BUTTON WRAP BAN (mandatory):** Button text MUST fit on one line at desktop. If a label like "VIEW SELECTED WORK" wraps to 2 or 3 lines, the button is broken. Fix by EITHER shortening the label (3 words max for primary CTAs, ideally 1-2) OR widening the button. Wrapped CTAs at desktop are a Pre-Flight Fail.
* **NO DUPLICATE CTA INTENT (mandatory):** Two CTAs with the same intent on one page is a Pre-Flight Fail. "Get in touch" + "Contact us" + "Let's talk" + "Start a project" = all "contact" intent -> pick ONE label and use it everywhere (nav, hero, footer). Same for "Try free" + "Get started" + "Sign up free" (all "signup"), and "View work" + "See selected work" + "Browse projects" (all "portfolio"). One label per intent.
* **FORM CONTRAST CHECK (mandatory, a11y):** Form inputs, placeholder text, focus rings, helper text, and error text all pass WCAG AA contrast against the section background. Light placeholders on a near-white form, white form on white page section, labels grayer than 4.5:1 -> all banned. Audit every form before shipping. (Prefer Craft `craft-text-input` / `craft-textarea` / `craft-select` from Stacks UI so states come styled.)

### 4.6 Data & Form Patterns
* Label ABOVE input. Helper text optional but present in markup. Error text BELOW input. Standard `gap-2` for input blocks.
* No placeholder-as-label. Ever.
* Reach for Stacks UI Craft form components (`craft-text-input`, `craft-checkbox`, `craft-select`) before hand-rolling inputs.

### 4.7 Layout Discipline (Hard Rules. Failing any of these is shipping broken work)

* **Hero MUST fit in the initial viewport.** Headline max 2 lines on desktop, subtext max **20 words** AND max 3-4 lines, CTAs visible without scroll. If the copy is too long: reduce font scale OR cut copy. If you cannot describe the value-prop in 20 words of subtext, the value-prop is unclear, not the rule too tight. Never let the hero overflow and force scroll to find the CTA.
* **Hero font-scale discipline.** Plan font size and image size *together*. If the hero asset is large and the headline is more than 6 words, do not start at `text-7xl`/`text-8xl`. Default sensible range: `text-4xl md:text-5xl lg:text-6xl` for most heroes; `text-6xl md:text-7xl` only when the headline is 3-5 words. A 4-line hero headline is always a font-size error, never a copy-length error.
* **HERO TOP PADDING CAP (mandatory):** Hero top padding max `pt-24` (about 6rem) at desktop. More than that means the hero content floats halfway down the viewport and reads as a layout bug, not intentional space. If your hero needs more breathing room, increase font scale or asset size, not top padding.
* **HERO STACK DISCIPLINE (max 4 text elements).** The hero is a single moment, not a feature list. Allowed text elements, max 4 in total:
  1. Eyebrow (small uppercase label) OR brand strip OR neither - pick zero or one
  2. Headline (max 2 lines, see above)
  3. Subtext (max 20 words, max 4 lines)
  4. CTAs (1 primary + max 1 secondary)
  - **BANNED in the hero:** tiny tagline below CTAs ("Works with GitHub, GitLab, and self-hosted Git"), trust micro-strip ("Used by engineering teams at..."), pricing teaser, feature bullet list, social-proof avatar row. All of those move to dedicated sections directly below the hero.
  - If you have an eyebrow AND a tagline below CTAs in the same hero, drop the tagline. One small text element per hero, max.
* **"Used by" / "Trusted by" logo wall belongs UNDER the hero, never inside it.** The hero is for the value prop and primary CTA. The logo wall is a separate section directly below.
* **Navigation MUST render on a single line on desktop.** If items don't fit at `lg` (1024px), condense labels, drop secondary items, or move to a hamburger (Stacks UI `Disclosure` / `Menu`). A two-line nav at desktop is broken design.
* **Navigation height cap: 80px max desktop, default 64-72px.** No huge "agency" nav bars that eat 15% of the viewport.
* **Bento grids MUST have rhythm, not one-sided repetition.** Do not stack 6 left-image / right-text rows. Vary the composition: alternate full-width feature rows, asymmetric tile sizes, vertical breaks.
* **BENTO CELL COUNT RULE (mandatory):** A bento grid has EXACTLY as many cells as you have content for. 3 items -> 3 cells. 5 items -> 5 cells. If your grid has an empty cell in the middle or at the end, you planned wrong. Re-shape the grid; do not paste a blank tile.
* **Section-Layout-Repetition Ban.** Once you use a layout family for a section (e.g. 3-column-image-cards, full-width-quote, split-text-image), that family can appear at most ONCE on the page. A landing page with 8 sections must use at least 4 different layout families.
* **ZIGZAG ALTERNATION CAP (mandatory).** Alternating "left-image + right-text" then "left-text + right-image" zigzag = banal. Max 2 sections in a row with this image+text-split pattern. The 3rd consecutive image+text split is a Pre-Flight Fail. Break the pattern with a full-width section, a vertical-stack section, a bento grid, a marquee, or a different layout family.
* **EYEBROW RESTRAINT (mandatory, the #1 violated rule in production tests).** An "eyebrow" is the small uppercase wide-tracking label sitting above a section headline (e.g. `FOUR COLORWAYS`, `SELECTED WORK`, `THE HARDWARE`). Typical CSS signature: `text-[11px] uppercase tracking-[0.18em]`, `font-mono text-[10.5px] uppercase tracking-[0.22em]`. Every AI-built site puts an eyebrow above EVERY section header, producing the same templated rhythm. Hard rule:
  - **Maximum 1 eyebrow per 3 sections.** Hero counts as 1. So a page with 9 sections may use at most 3 eyebrows total.
  - If section A has an eyebrow, the next 2 sections cannot have one.
  - **Pre-Flight Check is mechanical:** count instances of `uppercase tracking` (or similar small-caps mono labels above headlines) across all section components. If count > ceil(sectionCount / 3), the output fails.
  - **What to do instead of an eyebrow:** drop it entirely. The headline alone is enough. The section's location on the page already categorizes it.
* **SPLIT-HEADER BAN (mandatory).** The pattern "left big headline + right small explainer paragraph" as a section header (left col-span-7/8, right col-span-4/5 with a small body paragraph floating in the right column) is **banned as default**. Sections should have ONE focused message. If you genuinely need both a headline and an explainer, stack them vertically (headline on top, body below, max-width 65ch). Reach for the split-header pattern only when the right column carries a real visual or interactive element, not just filler text.
* **Bento Background Diversity (mandatory).** Bento and feature-grid sections cannot be 6 white-on-white cards with text inside. At least 2-3 cells in any multi-cell grid need real visual variation: a real image, a brand-appropriate gradient (not AI-purple), a pattern, a tinted background.
* **Mobile collapse must be explicit per section.** For every multi-column layout, declare the `< 768px` fallback in the same component. No "it'll work, Crosswind handles it" assumptions.

### 4.8 Image & Visual Asset Strategy

Landing pages and portfolios are **visual products**. Text-only pages with fake-screenshot divs are slop.

**Priority order for visual assets:**
1. **Image-generation tool first.** If ANY image-gen tool is available in the environment you MUST use it to create section-specific assets: hero photography, product shots, texture backgrounds, mood images. Generate at the right aspect ratio for the section. Do not skip this step because hand-rolled CSS feels faster.
2. **Real web images second.** When no gen tool is available, use real photography sources. Acceptable defaults:
   * `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}` for placeholder photography (seed should describe the section, e.g. `marrow-cookware-kitchen`)
   * Actual stock or brand URLs when the brief provides them
   * Open-license sources (Unsplash via direct URL, Pexels) if explicitly allowed
3. **Last resort: tell the user.** If neither is possible, do NOT fill the page with hand-rolled SVG illustrations or div-based "fake screenshots." Leave clearly-labeled placeholder slots (`<!-- TODO: hero product photo, 1600x1200 -->`) and at the end of the response say: *"This page needs real images at: \[list of placements\]. Please generate or provide them."*

**Serve images correctly (Stacks):** use standard `<img>` with explicit `width`/`height` to reserve space (avoid CLS). stx has an asset pipeline with image optimization; heavy asset handling goes through `@stacksjs/storage`. There is no `next/image`.

**Even minimalist sites need real images.** A pure-text page is not minimalism, it is incomplete work. Even an editorial Linear-style site needs at least 2-3 real images (hero, one product/lifestyle shot, one supporting image). Generate B&W minimalist photography if the brief is restrained; do not skip images because the dial is low.

**Real company logos for social proof.** When the brief calls for a "Trusted by / Used by / Customers" logo wall, do NOT default to plain text wordmarks. Use real SVG logos:
* **Source: Simple Icons** (`https://cdn.simpleicons.org/{slug}/{color}` for any color). Covers most known brands.
* **Alternative: an Iconify brand collection** (`i-logos-*`, `i-simple-icons-*`) rendered as a class.
* **Made-up brand name? Then make-up an SVG mark too.** Generate a simple monogram (one letter in a circle, two-letter ligature, abstract glyph) as an inline `<svg>` matching the page style. Plain text wordmarks for invented brands look generic.
* **Always** ensure logos render in both light and dark mode (white-on-dark, black-on-light, or a single-color theme variable).
* **LOGO-ONLY rule (mandatory):** logo wall = logos and nothing else. Do NOT print industry / category labels below each logo. The logo is the credibility. Optional: brand name as alt-text, optional link to the brand's site. That is it.

**Hand-rolled illustrations:**
* Iconify glyphs: fine (Section 3.C).
* Hand-rolled decorative SVGs (custom illustrations, logos, marks): **strongly discouraged**, never as default. Acceptable only when the brief explicitly calls for it, or it is a single simple geometric mark, and you are confident in the output quality.

**Div-based fake screenshots are banned.** A "hand-built product preview" rendered with `<div>` rectangles, fake task lists, fake dashboards, fake terminal windows is a Tell. To show a product: use a real screenshot URL, generate one, render a real mini-version of the actual UI, or skip the preview and use editorial photography.

**Hero needs a real visual.** Text + gradient blob is not a hero, it is a placeholder.

### 4.9 Content Density

Landing pages live on the **first impression**, not the full read. Cut ruthlessly.

* **Default content shape per section:** short headline (<= 8 words) + short sub-paragraph (<= 25 words) + one visual asset OR one CTA. Anything more must be justified by the section's job.
* **No data-dump sections.** A 20-row publication table, a 30-row award list, a giant pricing matrix on a marketing page = wrong layout. Use top 3-5 highlights + "View full list" link, a marquee/carousel for breadth, or a different page entirely if the data is the product.
* **Long lists need a different UI component, not a longer list.** Default `<ul>` with bullets / `divide-y` rows is the lazy choice. If you have > 5 items, reach for: a 2-column split with grouped items, a card grid with image + label, Tabs / Disclosure (Stacks UI) if items are categorisable, horizontal scroll-snap pills, a carousel, or a marquee. A spec sheet with 10 rows + a hairline under every row is the WORST default.
* **Spec sheets specifically.** A long product spec table with `border-b` on every row is the AI default for cookware / hardware / apparel / artisan briefs. Banned. Alternatives: a 2-col card grid (spec name + large display value + one-line "why it matters"), scroll-snap horizontal pills, grouped chunks (3 logical clusters, one soft divider each), or featured-vs-rest (3-4 hero specs as display tiles, the rest under a Stacks UI `Disclosure`).

* **COPY SELF-AUDIT (mandatory before ship):** Before declaring any task done, re-read every visible string (headlines, subheads, eyebrows, button labels, body copy, captions, alt text, footer text, error messages, including any `{{ ... }}` interpolations resolved). Flag any string that is:
  - **Grammatically broken** ("free on its past", "two plans but one is honest")
  - **Has unclear referents** ("we plan to stay that way" without prior context)
  - **Sounds like AI hallucination** (cute-but-wrong wordplay, forced metaphors, "elegant nothing" phrases)
  - **Reads like an LLM trying to sound thoughtful** (passive-aggressive humility, fake-craftsman labels, mock-poetic micro-meta)
  Rewrite every flagged string. If unsure whether a string makes sense, replace it with a plain functional sentence. AI-generated cute copy is worse than boring copy.
* **Fake-precise numbers are flagged.** Numbers like `92%`, `4.1x`, `48k`, `5.8 mm`, `13.4 lb` either come from real data (fine), are explicitly labeled as mock (`<!-- mock -->`, fine), or are AI-invented spec aesthetics (banned). Don't fake engineering precision the brand doesn't claim.
* **One copy register per page.** Don't mix technical mono, editorial prose, and marketing punch in the same composition unless the brand voice explicitly calls for it.

### 4.10 Quotes & Testimonials

* **Max 3 lines** of quote body. Never 6. If the original quote is longer, cut it. A landing-page quote is a snippet, not the full review.
* For very small font sizes (footer-style testimonials) the line cap can stretch slightly. Spirit: "fits in a glance."
* **No em-dashes inside the quote text** as design flourish. See Section 9.G - em-dash is completely banned.
* Attribution: name + role + (optionally) company. Never name only ("- Sarah").
* Quote marks: use real typographic quotes ( " " ) or none at all. Not straight ASCII.

### 4.11 Page Theme Lock (Light / Dark Mode Consistency)

The page has ONE theme. Sections do not invert.

* If the page is dark mode, ALL sections are dark mode. No light-mode-warm-paper section sandwiched between dark sections (or vice versa). The user must not feel they walked into a different website mid-scroll.
* The exception: if the brief explicitly calls for a "Color Block Story" or "Theme Switch on Scroll" device AND that is a deliberate composition (one full theme switch with a strong transition, not random alternation), it is allowed once per page.
* Default behaviour: pick light, dark, or auto (`prefers-color-scheme`) at the page level and lock it. Section-level background tints within the same theme family are fine (`bg-zinc-950` next to `bg-zinc-900`); flipping to `bg-amber-50` in the middle of a `bg-zinc-950` page is broken.
* Drive dark mode with the Crosswind `dark:` variant. If you offer a runtime toggle, set it ONCE at the layout/root level via `useColorMode()` / `useDark()` (see [stacks-crosswind](../stacks-crosswind)). Do not let individual sections override the theme.

---

## 5. CONTEXT-AWARE PROACTIVITY (Motion in Stacks)

These are tools, not defaults. Use them when the design read calls for them. **None of these fire automatically.**

**Stacks ships NO motion library.** There is no `motion/react`, no `framer-motion`, no `gsap`. All motion is built from three sources only:
1. **Crosswind transitions + CSS keyframes** in a `<style>` block (hover, micro-interactions, load-ins). Animate ONLY `transform` and `opacity`.
2. **stx composables** for observing state (`useIntersectionObserver`, `useElementVisibility`, `useMouse`, `useMediaQuery`, `useResizeObserver`, `useWindow`, `useDeviceOrientation`) - toggle a Crosswind class or set a CSS custom property.
3. **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) for pinned, stacked, and horizontal-pan effects - no script needed.

* **Glassmorphism:** Appropriate for premium consumer, Apple-adjacent, luxury, or media-overlay vibes. Inappropriate for dashboards, public-sector, "boring B2B." When used, go beyond `backdrop-blur`: add a 1px inner border (`border-white/10`) and a subtle inner shadow for physical edge refraction. Provide a solid-fill fallback under `prefers-reduced-transparency` (Appendix C).
* **Magnetic Micro-physics:** Use when `MOTION_INTENSITY > 5` AND the brief reads premium / playful / agency. Implement by driving a **CSS custom property** from `useMouse()` inside an `effect` (Section 5.D). Never through per-frame signal state. See Section 3.B.
* **Perpetual Micro-Interactions** (Pulse, Typewriter, Float, Shimmer, Carousel): Use when `MOTION_INTENSITY > 5` AND the section actively benefits from motion (status indicators, live feeds). **Not every card needs an infinite loop.** If a section is informational, leave it still. Prefer spring-like `cubic-bezier` easing over linear.
* **"Motion claimed, motion shown."** If `MOTION_INTENSITY > 4`, the page must actually move: entry transitions on hero, scroll-reveal on key sections, hover feedback on CTAs, at minimum. A static page that claims `MOTION_INTENSITY: 7` is broken. Conversely, if you cannot ship working motion in scope, drop the dial to 3 and ship a clean static page. Never half-build motion that breaks (jumpy enters, missing observer cleanups).
* **MOTION MUST BE MOTIVATED (mandatory).** Before adding any animation, ask: "what does this communicate?" Valid answers: hierarchy, storytelling (sequenced reveal matching a narrative), feedback (acknowledging an action), state transition. Invalid answer: "it looked cool." Each scroll-driven section, each marquee, each pinned section needs a reason. If you cannot articulate it in one sentence, drop the animation.
* **MARQUEE MAX-ONE-PER-PAGE (mandatory).** Horizontal scrolling text marquees are appropriate at most ONCE per page. Two or more reads as lazy filler. Pick the one section where the marquee serves the content; the others get a different layout.
* **Sticky-Stack Pattern (when scroll-stack is used).** A "card stack on scroll" must be a REAL sticky-stack, not a sequential reveal list. See Section 5.A. Common failure: the reveal fires halfway through scroll instead of pinning at viewport top. Fix: pin with `position: sticky; top: 0` so each card holds at the top of the viewport.
* **Horizontal-Pan Pattern (when horizontal scroll is used).** See Section 5.B. Common failure: the pan starts before the section is pinned so the user sees half a slide. Fix: pin the wrapper (`position: sticky; top: 0`) and drive the inner track with a `scroll()` timeline.

### 5.A Sticky-Stack - Canonical Skeleton (stx + CSS scroll-driven animation)

Pure CSS: each card is `position: sticky; top: 0`, and a `view()` timeline shrinks/fades it as the next card arrives. No script, no observer, no library. Reduced motion collapses it to a plain stack.

```html
<!-- resources/components/sticky-stack.stx -->
<template>
  <div class="sticky-stack relative">
    @foreach($cards as $card)
      <div class="stack-card sticky top-0 min-h-[100dvh] flex items-center justify-center">
        {{ $card }}
      </div>
    @endforeach
  </div>
</template>

<style>
  .stack-card {
    /* animate ONLY transform + opacity */
    animation: stack-shrink linear both;
    animation-timeline: view();
    animation-range: exit 0% exit 100%;
    transform-origin: center top;
    will-change: transform, opacity;
  }

  @keyframes stack-shrink {
    to {
      transform: scale(0.92);
      opacity: 0.55;
    }
  }

  /* mandatory: reduced motion collapses to a static stack */
  @media (prefers-reduced-motion: reduce) {
    .stack-card {
      animation: none;
      position: relative; /* stop pinning so nothing moves under scroll */
    }
  }
</style>
```

Critical points: `position: sticky; top: 0` pins each card at the viewport top; the shrink/fade is driven by the card's own `view()` timeline over its `exit` range (so it recedes as the next card arrives); reduced motion turns off both the animation and the pin.

### 5.B Horizontal-Pan - Canonical Skeleton (stx + CSS scroll-driven animation)

The wrapper reserves tall scroll length; a sticky inner viewport pins at the top; the track pans left, driven by a `scroll()` timeline over the wrapper. No script, no `window` listeners, no library.

```html
<!-- resources/components/horizontal-pan.stx -->
<template>
  <section class="pan-wrap relative">
    <div class="pan-sticky sticky top-0 h-[100dvh] overflow-hidden">
      <div class="pan-track flex h-full items-center">
        <slot />
      </div>
    </div>
  </section>
</template>

<style>
  /* wrapper reserves vertical scroll distance = how far the track travels */
  .pan-wrap { height: 300vh; }

  .pan-track {
    animation: pan-x linear both;
    animation-timeline: scroll(root block);
    will-change: transform;
  }

  @keyframes pan-x {
    /* travel = trackWidth - 100vw; tune per content width */
    to { transform: translateX(calc(-1 * (100% - 100vw))); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pan-wrap { height: auto; }
    .pan-sticky { position: relative; height: auto; overflow-x: auto; }
    .pan-track { animation: none; }
  }
</style>
```

Critical points: pin the sticky viewport (`sticky top-0 h-[100dvh]`), drive the track with a `scroll()` timeline, and size `.pan-wrap` height to the horizontal travel needed. Under reduced motion the section degrades to a plain horizontally-scrollable row.

### 5.C Scroll-Reveal Stagger - Canonical Skeleton (useIntersectionObserver + Crosswind class toggle)

For simple "items appear as they enter viewport" (no pinning), use `useIntersectionObserver` to toggle a Crosswind class. Lighter than any timeline; no library.

```html
<!-- resources/components/reveal-stagger.stx -->
<script client>
  // element ref for the list container
  const listRef = useRef('reveal-list')
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')

  // reveal each child when the container enters the viewport
  const { isVisible } = useIntersectionObserver(listRef, { threshold: 0.3 })

  // toggle the class once, on enter (never write signal state per scroll frame)
  effect(() => {
    if (reduce() || isVisible())
      listRef.value?.classList.add('is-revealed')
  })
</script>

<template>
  <ul ref="reveal-list" class="reveal grid gap-6">
    @foreach($items as $i => $item)
      <li class="reveal-item" style="--i: {{ $i }}">{{ $item }}</li>
    @endforeach
  </ul>
</template>

<style>
  .reveal-item {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    /* stagger via CSS custom property, not per-item JS timers */
    transition-delay: calc(var(--i) * 60ms);
  }
  .reveal.is-revealed .reveal-item {
    opacity: 1;
    transform: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal-item { opacity: 1; transform: none; transition: none; }
  }
</style>
```

Use this for: feature lists, testimonial grids, logo walls, anything that just needs "enter on scroll." The observer flips ONE class; the stagger is pure CSS via `--i`. Under reduced motion items are visible immediately.

### 5.D Pointer / Magnetic - Canonical Skeleton (useMouse -> CSS custom property inside an effect)

Track the pointer with `useMouse()` and write the offset to a **CSS custom property** inside an `effect`. The property drives a `transform` in CSS. Signal state is read, never written per frame; the reactive tree does not re-run on every pointer move.

```html
<!-- resources/components/magnetic.stx -->
<script client>
  const btnRef = useRef('magnet')
  const { x, y } = useMouse()
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')

  effect(() => {
    const el = btnRef.value
    if (!el || reduce())
      return
    const r = el.getBoundingClientRect()
    // pull toward cursor, damped; write to a CSS var, do NOT set signal state
    const dx = (x() - (r.left + r.width / 2)) * 0.2
    const dy = (y() - (r.top + r.height / 2)) * 0.2
    el.style.setProperty('--mx', `${dx}px`)
    el.style.setProperty('--my', `${dy}px`)
  })
</script>

<template>
  <button ref="magnet" class="magnet px-6 py-3 rounded-full">
    <slot />
  </button>
</template>

<style>
  .magnet {
    transform: translate(var(--mx, 0), var(--my, 0));
    transition: transform 0.15s ease-out;
    will-change: transform;
  }
  @media (prefers-reduced-motion: reduce) {
    .magnet { transform: none; transition: none; }
  }
</style>
```

Critical points: `useMouse()` values are read inside `effect`, the effect sets a CSS custom property, and CSS applies the `transform`. No per-frame signal writes, no `window` listeners, no `requestAnimationFrame` loop touching state.

### 5.E Forbidden Animation Patterns

* **`window.addEventListener('scroll', ...)`** is banned. It runs on every scroll frame, jank-prone, no batching. Use `useIntersectionObserver` / `useElementVisibility`, or CSS scroll-driven animations (`animation-timeline: view()` / `scroll()`).
* **Any bare `window.*` or `document.*` access in an stx `<script>`** is banned (CLAUDE.md rule). Use composables (`useEventListener`, `useWindow`, `useResizeObserver`, `useMouse`) instead. Also banned: `var`.
* **Custom scroll-progress calculations written into signal state.** Re-runs reactive effects on every frame. Drive a CSS custom property inside an `effect` (Section 5.D) or use a CSS `scroll()` timeline instead.
* **`requestAnimationFrame` loops that write signal state.** Same reason. Prefer CSS-driven animation or a single CSS custom property write per frame from within an `effect`.
* **Staggered orchestration:** use the CSS cascade (`transition-delay: calc(var(--i) * 60ms)` / `animation-delay`) for reveal sequence, as in Section 5.C. Do not spin up a JS timer per item.

---

## 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS

### 6.A Hardware Acceleration
* Animate ONLY `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`.
* Use `will-change: transform` sparingly, only on elements that will actually animate.

### 6.B Reduced Motion (mandatory)
* **Any motion above `MOTION_INTENSITY > 3` MUST honor `prefers-reduced-motion`.** This is non-negotiable.
* In CSS: gate animations behind `@media (prefers-reduced-motion: no-preference)`, or provide an override block under `@media (prefers-reduced-motion: reduce)` that disables them (as every skeleton in Section 5 does).
* In script: read `useMediaQuery('(prefers-reduced-motion: reduce)')` and skip the effect when it is true.
* Infinite loops, parallax, scroll-driven pins, and magnetic pointer effects MUST collapse to static / instant under reduced motion.

### 6.C Dark Mode (mandatory for any consumer-facing page)
* Design for **both modes from the start**. Never ship light-only or dark-only without explicit user instruction.
* Use the Crosswind `dark:` variant (`bg-white dark:bg-zinc-950`, `text-gray-900 dark:text-gray-100`) OR CSS variables for tokens. Pick one strategy per project.
* **Do not prescribe specific dark-mode colors here.** The brief decides. Maintain visual hierarchy, brand identity, and WCAG AA contrast (AAA for body) across both modes.
* Respect `prefers-color-scheme: dark`. Default to system preference unless the brand insists on one mode. Runtime toggle via `useColorMode()` / `useDark()`.

### 6.D Core Web Vitals Targets
* **LCP** < 2.5s. Preload the hero image; do not lazy-load above-the-fold assets.
* **INP** < 200ms. Keep heavy work out of the main render path; put data work in `<script server>`.
* **CLS** < 0.1. Reserve space for images (explicit `width`/`height`), fonts (`display: swap`), and embeds.

### 6.E DOM Cost
* Apply grain / noise filters EXCLUSIVELY to fixed, `pointer-events-none` pseudo-elements (e.g. `fixed inset-0 z-[60] pointer-events-none`). NEVER on scrolling containers - continuous GPU repaints destroy mobile FPS.
* Be aware of bundle size. Lazy-load anything below the fold and heavy.

### 6.F Z-Index Restraint
NEVER spam arbitrary `z-50` or `z-10`. Use z-index strictly for systemic layer contexts (sticky navbars, modals, overlays, grain). Document the z-index scale in a project constants file or the layout `<style>`.

---

## 7. DIAL DEFINITIONS (Technical Reference)

### DESIGN_VARIANCE (Level 1-10)
* **1-3 (Predictable):** Symmetrical CSS Grid (12-col, equal fr-units), equal paddings, centered alignment.
* **4-7 (Offset):** negative-margin overlaps, varied image aspect ratios (4:3 next to 16:9), left-aligned headers over center-aligned data.
* **8-10 (Asymmetric):** Masonry layouts, CSS Grid with fractional units (`grid-cols-[2fr_1fr_1fr]`), massive empty zones (`pl-[20vw]`).
* **MOBILE OVERRIDE:** For levels 4-10, asymmetric layouts above `md:` MUST collapse to strict single-column (`w-full`, `px-4`, `py-8`) on viewports `< 768px`.

### MOTION_INTENSITY (Level 1-10)
* **1-3 (Static):** No automatic animations. CSS `:hover` and `:active` states only. `prefers-reduced-motion` is the default mode anyway.
* **4-7 (Fluid CSS):** `transition` with `cubic-bezier(0.16, 1, 0.3, 1)`. `transition-delay` / `animation-delay` cascades for load-ins. Focus on `transform` and `opacity`.
* **8-10 (Advanced Choreography):** CSS scroll-driven animation (`animation-timeline: view()` / `scroll()`), sticky pins, staggered reveals via `useIntersectionObserver`. **NEVER use `window.addEventListener('scroll')`** - it is a hard ban, not a preference. See Section 5.E.

### VISUAL_DENSITY (Level 1-10)
* **1-3 (Art Gallery):** Lots of white space. Huge section gaps (`py-32` to `py-48`). Expensive, clean.
* **4-7 (Daily App):** Standard web app spacing (`py-16` to `py-24`).
* **8-10 (Cockpit):** Tight paddings. No card boxes; 1px lines separate data. Mandatory: `font-mono` for all numbers.

---

## 8. DARK MODE PROTOCOL

Dual-mode by default. Never assume light-only unless the brief is print-emulating editorial.

### 8.A Token Strategy (pick one, stick to it)
* **Crosswind `dark:` variant** (default for utility-first projects): every color utility paired with its dark variant (`bg-white dark:bg-zinc-950`, `text-gray-900 dark:text-gray-100`).
* **CSS variables** (for token-driven theming): define semantic tokens (`--surface`, `--surface-elevated`, `--text-primary`, `--accent`) in the layout `<style>` and swap values under `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)`.

### 8.B Do Not Prescribe Specific Colors Here
The brief and brand decide. This skill enforces only:
* **Contrast** - WCAG AA minimum for body text, AAA target for hero copy.
* **Hierarchy parity** - visual hierarchy that works in light must work in dark. If a CTA pops in light, it pops in dark.
* **Brand fidelity** - primary brand color stays recognisable. Don't desaturate the brand into a dark mode.
* **No pure `#000000` and no pure `#ffffff`** - use off-black (zinc-950, near-black warm gray) and off-white. Pure values kill depth.

### 8.C Default Mode
Respect `prefers-color-scheme` unless the brand insists. Add a manual toggle (`useColorMode()` / `useDark()`) if either mode would lose key brand expression.

### 8.D Test in Both Modes Before Finishing
View the page in both modes during development. Do not ship a page you have only seen in one mode.

---

## 9. AI TELLS (Forbidden Patterns)

Avoid these signatures unless the brief explicitly asks for them.

### 9.A Visual & CSS
* **NO neon / outer glows** by default. Use inner borders or subtle tinted shadows.
* **NO pure black (`#000000`).** Off-black, zinc-950, or charcoal.
* **NO oversaturated accents.** Desaturate to blend with neutrals.
* **NO excessive gradient text** for large headers.
* **NO custom mouse cursors.** Outdated, accessibility-hostile, perf-hostile.

### 9.B Typography
* **AVOID Inter as default.** See Section 4.1. Override path exists.
* **NO oversized H1s** that just scream. Control hierarchy with weight + color, not raw scale.
* **Serif constraints:** Serif for editorial / luxury / publication. Not for dashboards.

### 9.C Layout & Spacing
* **Mathematically perfect** padding and margins. No floating elements with awkward gaps.
* **NO 3-column equal feature cards.** The generic "three identical cards horizontally" feature row is banned. Use 2-column zig-zag, asymmetric grid, scroll-pinned, or horizontal-scroll alternative.

### 9.D Content & Data ("Jane Doe" Effect)
* **NO generic names.** "John Doe", "Sarah Chan", "Jack Su" -> use creative, realistic, locale-appropriate names.
* **NO generic avatars.** No SVG "egg" or generic user icons -> use believable photo placeholders or specific styling.
* **NO fake-perfect numbers.** Avoid `99.99%`, `50%`, `1234567`. Use organic, messy data (`47.2%`, `+1 (312) 847-1928`).
* **NO startup-slop brand names.** "Acme", "Nexus", "SmartFlow", "Cloudly" -> invent contextual, premium names that sound real.
* **NO filler verbs.** "Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize" -> concrete verbs only.

### 9.E External Resources & Components
* **NO hand-rolled SVG icons.** Use Iconify `i-*` classes (hugeicons default). See Section 3.C.
* **NO `npm install` of icon packages** (lucide-react, @phosphor-icons, etc.). Iconify classes ship with stx.
* **Hand-rolled decorative SVGs strongly discouraged** as default (see Section 4.8).
* **NO div-based fake screenshots.** Never build a fake product UI out of `<div>` rectangles. Use real images, generated images, a real component preview, or skip the preview.
* **NO broken Unsplash links.** Use `https://picsum.photos/seed/{descriptive-string}/{w}/{h}`, generated placeholders, or actual assets.
* **Use Stacks UI components, don't recreate them.** Do not hand-build a modal, tabs, popover, or combobox that already exists in `@stacksjs/ui`. Customize radii, colors, shadows, typography to the project aesthetic.
* **Production-Ready Cleanliness:** Code visually clean, memorable, meticulously refined.

### 9.F Production-Test Tells (banned outright)

These patterns came out of real LLM-generated landing-page tests. Treat them as hard bans unless the brief explicitly calls for one.

**Hero & top-of-page**
* **NO version labels in the hero.** `V0.6`, `v2.0`, `BETA`, `INVITE-ONLY PREVIEW`, `EARLY ACCESS`, `ALPHA` - banned as default eyebrows. Only acceptable when the brief is explicitly about a product launch / preview status.
* **NO "Brand . No. 01"-style sub-eyebrows.** "Marrow . No. 01 . The 6-quart" type micro-meta lines. Skip them.

**Section numbering & micro-labels**
* **NO section-number eyebrows.** `00 / INDEX`, `001 . Capabilities`, `06 . how it works`, `05 . The honest table` - banned. Eyebrows name the topic in plain language, not enumerate.
* **NO `01 / 4`-style pagination on images or bento tiles.** If the user can count, they don't need the label.
* **NO `Scroll . 001 Capabilities`-style scroll cues.** A simple arrow or "Scroll" is enough; no section-number prefix.
* **NO "Index of Work, 2018 - 2026"-style range labels** as eyebrows. Just say what the section is.

**Separators & dots**
* **The middle-dot (`.`) separator is rationed.** Maximum 1 per line in metadata strips. Do NOT use it as the default separator for everything. Prefer line breaks, hairlines, or columns.
* **NO decorative colored status dots on every list/nav/badge.** A colored dot before "ONE Q4 SLOT OPEN" or before every nav link is banned by default. Acceptable only when the dot conveys actual semantic state (server status, availability flag) and is used sparingly.

**Em-dashes & typography flourishes**
* **NO em-dash (`—`) as a design element OR anywhere else.** See Section 9.G below for the complete, non-negotiable ban. The em-dash character is forbidden in headlines, eyebrows, pills, body copy, quotes, attribution, captions, button text, and alt text. Use the regular hyphen (`-`).
* **NO `<br>`-broken-and-italicized headlines** as a default "design move." Headlines should read naturally first, get clever only when the brief demands it.
* **NO vertical rotated text** ("INDEX OF WORK" rotated 90 degrees). Agency-portfolio cliche. Use it only when the brief is explicitly agency / Awwwards / experimental AND it serves a real composition purpose.
* **NO crosshair / hairline grid lines as decoration.** Vertical and horizontal lines drawn just to make the page "feel designed" are banned. Use them only when they organize real content.

**Fake product previews**
* **NO div-based fake product UI in the hero** (fake task list, fake terminal, fake dashboard built from styled divs). It is the #1 LLM-design Tell. Use a real screenshot, a generated image, a real component preview, or none at all.
* **NO fake version footers** ("v0.6.2-rc.1", "last sync 4s ago . main") inside fake screenshots.

**Marketing-copy Tells**
* **NO "Quietly in use at" / "Quietly trusted by"** social-proof headers. Use "Trusted by", "Used at", "Customers include", or skip the heading.
* **NO "From the field" / "Field notes" / "Currently on the bench" / "On our desks"** style poetic labels on quote, blog, or sidebar sections. Use plain functional labels ("Testimonials", "Latest writing", "Now working on") or skip the label.
* **NO "We respect the French ones"-style** mock-humble industry references in body copy.
* **NO weather / locale strips** ("LIS 14:23 . 18C") in headers/footers unless the brief is explicitly about a place / time-zone-distributed studio.
* **NO micro-meta-sentences under eyebrows.** Eyebrow + Headline + Body is enough.
* **NO generic step labels.** "Stage 1 / Stage 2 / Stage 3", "Phase 01 / Phase 02 / Phase 03", "Pass One / Pass Two". The actual step content is the label. Use the verb-noun directly ("Install", "Configure", "Ship").

**Pills, labels and version stamps**
* **NO pills/labels/tags overlaid on images.** No `<span>` overlays on photos with tags like `Brand . 02`, `PLATE . BRAND`. Either let the image speak alone, or add a caption directly below (outside the image).
* **NO photo-credit captions as decoration.** Strings like `Field study no. 12 . Ines Caetano` under stock/picsum images are pretentious. Photo credit is allowed ONLY for a real photographer credited for a real photo (with permission).
* **NO version footers on marketing pages.** Footer strings like `v1.4.2`, `Build 0048`, `last sync 4s ago . main` are devtool fixtures, not landing-page content.
* **NO "Reservation 412 of 800"-style live-stock counters** as decoration. Only if the brief is explicitly a limited-run waitlist with real data.

**Decoration text strips**
* **NO decoration text strip at hero bottom.** Patterns like `BRAND. MOTION. SPATIAL.`, `TYPE / FORM / MOTION`, `DESIGN . BUILD . SHIP` as a small mono-caps strip across the bottom of the hero are an agency-portfolio cliche. Only acceptable when the strip carries real navigable links or real status info.
* **NO floating top-right sub-text in section headings.** A tiny explainer paragraph floating in the top-right corner of a section header with no clear alignment is the Tell. Put the sub-text directly under the headline, or build a clean aligned 2-column header.

**Lists, dividers and scoring**
* **NO `border-t` + `border-b` on every row of a long list / spec table.** Pick one and use it sparsely. See Section 4.9 for alternative UI components.
* **NO scoring/progress bars with filled background tracks** as comparison visuals. Prefer a number + small icon, or a tiny inline bar WITHOUT a background track.

**Locale, time, scroll cues**
* **Locale / city-name / time / weather strips are banned for 99% of briefs.** Allowed ONLY when the brief explicitly describes a globally-distributed studio, a travel brand, or a real-world physical venue. A single contact-address mention in the footer is fine; an atmospheric locale strip is not.
* **Scroll cues are banned.** `Scroll`, `scroll to explore`, animated mouse-wheel icons. If the user has not scrolled yet, they are looking at the hero. They know what scroll is.
* **ZERO decorative status dots by default.** Only acceptable when conveying real semantic state, limited to one per page section.

### 9.G EM-DASH BAN (the single most-violated Tell)

**Em-dash (`—`) is COMPLETELY banned.** It is the LLM's signature stylistic crutch and the #1 visual Tell in production tests. There is no "limited use" allowance, no "natural language frequency" allowance, no "in body copy is fine" allowance. None.

* **Banned in headlines.** Use a period or a comma.
* **Banned in eyebrows / labels / pills / button text / image captions / nav items.** Replace with line breaks, columns, or hairlines.
* **Banned in body copy.** Restructure the sentence: two sentences with a period, OR a comma, OR parentheses, OR a colon.
* **Banned in quote attribution.** Use a normal hyphen with spaces (` - `) or a line break + smaller-weight name.
* **Banned in en-dash form too (`–`) when used as a separator.** Date ranges (`2018-2026`) use a hyphen. Number ranges (`40-80k`) use a hyphen.

The ONLY permitted dash characters on the page are:
* Regular hyphen `-` (for compound words, ranges, line dividers in markup)
* Minus sign in math (`-5C`)

If your output contains a single `—` or `–` anywhere visible to the user, the output fails the Pre-Flight Check and must be rewritten.

This rule is non-negotiable. The agent has historically ignored em-dash limits when phrased as "use sparingly." The phrasing here is binary: zero em-dashes.

---

## 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)

This is a vocabulary. Know these pattern names to communicate about them and reach for them when the design read calls for them. All implementations are stx + Crosswind + composables / CSS (Section 5), never an external motion library.

### Hero Paradigms
* **Asymmetric Split Hero** - Text on one side, asset on the other, generous white space.
* **Editorial Manifesto Hero** - Large type, no asset, almost-poster.
* **Video / Media Mask Hero** - Type cut out as mask over video background.
* **Kinetic-Type Hero** - Animated typography (CSS keyframes) as the primary visual.
* **Scroll-Pinned Hero** - Hero stays pinned (`position: sticky`) while content scrolls behind.

### Navigation & Menus
* **Magnetic Button** - Pulls toward cursor (Section 5.D).
* **Dynamic Island** - Morphing pill for status / alerts.
* **Mega Menu Reveal** - Full-screen dropdown (Stacks UI `Menu` / `Disclosure` + `Transition`).

### Layout & Grids
* **Bento Grid** - Asymmetric tile grouping (Apple Control Center).
* **Masonry Layout** - Staggered grid, no fixed row height.
* **Split-Screen Scroll** - Two halves sliding in opposite directions (CSS `scroll()` timeline).
* **Sticky-Stack Sections** - Sections that pin and stack on scroll (Section 5.A).

### Cards & Containers
* **Parallax Tilt Card** - 3D tilt tracking mouse coordinates via `useMouse()` -> CSS var.
* **Spotlight Border Card** - Border illuminates under cursor (CSS var driven by `useMouse()`).
* **Glassmorphism Panel** - Frosted glass with inner refraction (Appendix C).

### Scroll Animations
* **Sticky Scroll Stack** - Cards stick and physically stack (Section 5.A).
* **Horizontal Scroll Hijack** - Vertical scroll to horizontal pan (Section 5.B).
* **Zoom Parallax** - Central background image zooming on scroll (CSS `view()` timeline).
* **Scroll Progress Path** - SVG line drawing along scroll (CSS `scroll()` timeline).

### Typography & Text
* **Kinetic Marquee** - Endless text bands (CSS keyframes, max one per page).
* **Text Mask Reveal** - Massive type as transparent window to video.
* **Circular Text Path** - Text curving along a spinning circle.

### Micro-Interactions & Effects
* **Skeleton Shimmer** - Shifting light reflection across placeholders (CSS keyframes).
* **Directional Hover-Aware Button** - Fill enters from cursor's side.
* **Ripple Click Effect** - Wave from click coordinates (CSS var from click position).
* **Mesh Gradient Background** - Organic blobs (layered radial gradients).

### Motion Implementation (Stacks, not a library)
* **Crosswind transitions + CSS keyframes** - default for hover, micro-interactions, load-ins.
* **`useIntersectionObserver` / `useElementVisibility`** - enter-on-scroll, toggle a class (Section 5.C).
* **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) - pinned, stacked, horizontal-pan (Sections 5.A, 5.B).
* **`useMouse()` -> CSS custom property in an `effect`** - pointer / magnetic / tilt (Section 5.D).
* **NEVER import `motion/react`, `framer-motion`, or `gsap`.** Stacks ships none of them, and per-frame signal state fights the reactive system.

---

## 11. REDESIGN PROTOCOL

This skill handles **greenfield builds AND redesigns**. Misclassifying the mode is the single biggest source of bad redesign output. For a full redesign audit workflow see [stacks-redesign](../stacks-redesign).

### 11.A Detect the Mode (first action)
* **Greenfield** - no existing site, or full overhaul approved. Dial baseline from Section 1.
* **Redesign - Preserve** - modernise without breaking the brand. Audit first, extract brand tokens, evolve gradually.
* **Redesign - Overhaul** - new visual language on top of existing content. Treat as greenfield for visuals; preserve content and IA.

If ambiguous, ask **once**: *"Should this redesign preserve the existing brand, or are we starting visually from scratch?"*

### 11.B Audit Before Touching
Document the current state before proposing changes:
* **Brand tokens** - primary / accent colors, type stack, logo treatment, radii.
* **Information architecture** - page tree, primary nav, key conversion paths.
* **Content blocks** - what exists, what's doing work, what's filler.
* **Patterns to preserve** - signature interactions, recognisable hero, copy voice.
* **Patterns to retire** - AI-slop tells, broken layouts, dead links, generic stock imagery, perf traps.
* **Dial reading of the existing site** - infer current `DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`. That's your starting point, not the baseline.
* **SEO baseline** - current ranking pages, meta titles (`@seo` / `@meta` / `useSeoMeta`), structured data, OG cards. **SEO migration is the #1 redesign risk.**

### 11.C Preservation Rules
* **Do not change information architecture** unless asked. Keep route slugs, anchor IDs, primary nav labels stable for SEO and muscle memory.
* **Extract brand colors before applying Section 4.2.** A brand that is already purple stays purple - apply the LILA RULE's override.
* **Preserve copy voice** unless asked for a rewrite. Visual modernisation is not a content rewrite.
* **Honor existing accessibility wins.** Do not regress focus states, alt text, keyboard nav, contrast.
* **Respect existing analytics events.** Do not rename buttons, form fields, section IDs that downstream tracking depends on.

### 11.D Modernisation Levers (priority order)
Apply in order, stop when the brief is satisfied:
1. **Typography refresh** - biggest visual lift per unit of risk.
2. **Spacing & rhythm** - increase section padding, fix vertical rhythm.
3. **Color recalibration** - desaturate, unify neutrals, keep brand accent.
4. **Motion layer** - add `MOTION_INTENSITY`-appropriate micro-interactions (Section 5) to existing components.
5. **Hero & key-section recomposition** - restructure top-of-funnel using Section 10 vocabulary.
6. **Full block replacement** - only when the existing block is unsalvageable.

### 11.E Decision Tree: Targeted Evolution vs Full Redesign
* IA, content, and SEO sound -> **targeted evolution** (Levers 1-4). ~70% of value at ~40% of risk.
* Visual debt is structural (broken IA, no design system, broken mobile) -> **full redesign** with strict content preservation.
* Brand itself is changing -> **greenfield**.

### 11.F What Never Changes Silently
Never modify without explicit user approval:
* URL structure / route slugs.
* Primary nav labels.
* Form field names or order (breaks analytics + autofill).
* Brand logo or wordmark.
* Existing legal / consent / cookie copy.

---

## 12. OUTPUT DISCIPLINE

When you deliver, hand off cleanly. For the full output-format contract (file placement, what to state, how to summarize), see [stacks-design-output](../stacks-design-output).

* Put pages in `resources/views/*.stx`, reusable blocks in `resources/components/*.stx`, shared chrome in `resources/layouts/*.stx`.
* Every block must work standalone: drop it into a page, it renders.
* Every block must pass the Pre-Flight Check (Section 14).
* State the design read (Section 0.B) and the dial values before the code.

---

## 13. OUT OF SCOPE

This skill is NOT for:
* Dashboards / dense product UI / admin panels -> use [stacks-dashboard](../stacks-dashboard) and [stacks-ui](../stacks-ui).
* Data tables -> use [stacks-ui](../stacks-ui) table primitives and [stacks-dashboard](../stacks-dashboard).
* Multi-step forms / wizards -> Craft form components in [stacks-ui](../stacks-ui); this skill won't make them better.
* Realtime collab UIs (presence, cursors) -> different problem class.

If the brief is one of the above, **say so explicitly**, point to the right skill, and only apply this skill's marketing-page / landing-page / about-page parts to the surfaces where they apply.

---

## 14. FINAL PRE-FLIGHT CHECK

Run this matrix before outputting code. This is the last filter.

**THIS IS NOT OPTIONAL. Run every box. If any box fails, the output is not done.**

- [ ] **Brief inference** declared (Section 0.B one-liner)?
- [ ] **Dial values** explicit and reasoned from the brief, not silently using baseline?
- [ ] **Foundation** is the Stacks stack (Stacks UI + Crosswind + Iconify), no `npm install` of an external design system or icon package?
- [ ] **Redesign mode** detected and audit performed (if applicable, Section 11)?
- [ ] **ZERO em-dashes (`—`) anywhere on the page.** Headlines, eyebrows, pills, body, quotes, attribution, captions, buttons, alt text. Zero. (Section 9.G - non-negotiable.)
- [ ] **No `var`, no bare `document.*` / `window.*`** in any stx `<script>` block?
- [ ] **Page Theme Lock**: ONE theme (light, dark, or auto) for the whole page, no section flips mid-page (Section 4.11)?
- [ ] **Color Consistency Lock**: one accent color used identically across all sections (Section 4.2)?
- [ ] **Shape Consistency Lock**: one corner-radius system applied consistently (Section 4.4)?
- [ ] **Button Contrast Check**: every CTA text readable against its background (no white-on-white, WCAG AA 4.5:1)?
- [ ] **CTA Button Wrap**: no CTA label wraps to 2+ lines at desktop?
- [ ] **Form Contrast Check**: inputs, placeholders, focus rings, labels all pass WCAG AA against the section background?
- [ ] **Serif discipline**: if a serif is used, it is NOT Fraunces or Instrument_Serif (or it is, with explicit brand justification)? Different serif from your previous project?
- [ ] **Premium-consumer palette check**: if the brief is premium-consumer, the palette is NOT the AI-default beige+brass+oxblood+espresso family? Different family from your previous premium-consumer project?
- [ ] **Italic descender clearance**: every italic word with `y g j p q` has `leading-[1.1]` min + `pb-1` reserve?
- [ ] **Hero fits the viewport**: headline <= 2 lines, subtext <= 20 words AND <= 4 lines, CTA visible without scroll, font scale planned around image?
- [ ] **Hero top padding**: max `pt-24` at desktop, hero content does not float halfway down?
- [ ] **Hero stack discipline**: max 4 text elements? No tiny tagline below CTAs, no trust micro-strip in hero?
- [ ] **EYEBROW COUNT (mechanical)**: count `uppercase tracking` micro-labels above section headlines across all components. Count <= ceil(sectionCount / 3)? Hero counts as 1.
- [ ] **Split-Header Ban**: no "left big headline + right small explainer paragraph" section header (vertical stack instead)?
- [ ] **Zigzag Alternation Cap**: no 3+ consecutive sections with the same image+text-split layout?
- [ ] **No Duplicate CTA Intent**: no two CTAs with the same intent on the page?
- [ ] **Logo wall = logo only**: no industry / category labels printed below logos?
- [ ] **Bento Background Diversity**: at least 2-3 bento cells have real visual variation, not all white-on-white text cards?
- [ ] **"Used by / Trusted by" logo wall** lives UNDER the hero, uses REAL SVG logos (Simple Icons / Iconify brand collections) or generated SVG marks, NOT plain text wordmarks?
- [ ] **Copy Self-Audit**: every visible string re-read, no grammatically-broken or AI-hallucinated phrases shipped?
- [ ] **Motion motivated**: every animation justified in one sentence (hierarchy / storytelling / feedback / state transition)?
- [ ] **Marquee max-one-per-page**: no two horizontal marquees on the same page?
- [ ] **Navigation on ONE line** at desktop, height <= 80px?
- [ ] **Section-Layout-Repetition** check: no two sections share the same layout family (at least 4 different families across 8 sections)?
- [ ] **Bento has rhythm AND exact cell count** (N items -> N cells, no empty cells)?
- [ ] **Long lists use the right UI component** (not default `<ul>` with `divide-y` for > 5 items)?
- [ ] **Real images used** (gen-tool first, then Picsum-seed, then explicit placeholder slots) - NO div-based fake screenshots, NO hand-rolled decorative SVGs, NO pure-text minimalism?
- [ ] **Images have explicit `width`/`height`** (reserve space, avoid CLS)?
- [ ] **No pills/labels overlaid on images**?
- [ ] **No photo-credit captions as decoration**?
- [ ] **No version footers** (`v1.4.2`, `Build 0048`) on marketing pages?
- [ ] **No micro-meta-sentences** under eyebrows?
- [ ] **No decoration text strip at hero bottom** (`BRAND. MOTION. SPATIAL.`)?
- [ ] **No floating top-right sub-text** in section headings?
- [ ] **No scoring/progress bars with filled background tracks** as comparison visuals?
- [ ] **No locale / city-name / time / weather strips** unless the brief is genuinely globally-distributed or place-focused?
- [ ] **No scroll cues** (`Scroll`, `scroll to explore`)?
- [ ] **No version labels in hero** (V0.6, BETA, INVITE-ONLY) unless the brief is a launch?
- [ ] **No section-numbering eyebrows** (`00 / INDEX`, `001 . Capabilities`)?
- [ ] **No decorative dots** (zero by default, only for real semantic state)?
- [ ] **No `border-t` + `border-b` on every row** of long lists / spec tables?
- [ ] **Content density** sane: no 20-row data tables, no fake-precise specs without justification, <= 25-word sub-paragraphs by default?
- [ ] **Quotes <= 3 lines** of body, attribution clean (no em-dash)?
- [ ] **Motion claimed = motion shown**: if `MOTION_INTENSITY > 4`, page actually animates?
- [ ] **Sticky-stack / horizontal-pan** implemented per Section 5.A / 5.B (`position: sticky; top: 0` pin + CSS `view()` / `scroll()` timeline, reduced-motion gated)?
- [ ] **No `window.addEventListener('scroll')`**, no per-frame signal-state scroll math - using `useIntersectionObserver` / CSS scroll-driven animations only (Section 5.E)?
- [ ] **Pointer / magnetic** effects drive a CSS custom property from `useMouse()` inside an `effect`, never per-frame signal state (Section 5.D)?
- [ ] **Reduced motion** gated for everything `MOTION_INTENSITY > 3` (CSS media block AND/OR `useMediaQuery('(prefers-reduced-motion: reduce)')`)?
- [ ] **Dark mode** tokens defined and tested in both modes (Crosswind `dark:` or CSS vars + `useColorMode()`)?
- [ ] **Mobile collapse** explicit (`w-full`, `px-4`, `max-w-7xl mx-auto`) for high-variance layouts?
- [ ] **Viewport stability**: `min-h-[100dvh]`, never `h-screen`?
- [ ] **Observer / effect cleanup** relied on (composables handle teardown; do not leave dangling `useEventListener`)?
- [ ] **Empty / loading / error** states provided?
- [ ] **Cards omitted** in favor of spacing where possible?
- [ ] **Icons** from Iconify `i-*` classes only (hugeicons default), no hand-rolled SVG paths, no icon npm packages?
- [ ] **Interactive logic isolated** in `<script client>`, data/secrets in `<script server>`?
- [ ] **No AI Tells** from Section 9 (Inter as default, AI-purple, three-equal cards, Jane Doe, Acme, "Quietly in use at")?
- [ ] **Core Web Vitals** plausibly hit (LCP < 2.5s, INP < 200ms, CLS < 0.1)?
- [ ] **One system** per project (the Stacks stack, no mixed external frameworks)?

If a single checkbox cannot be honestly ticked, the page is not done. Fix it before delivering.

---

# APPENDIX - Stacks Foundation & Approximations

## Appendix A - Stacks foundation note

There is no external-design-system install matrix for a Stacks app. The foundation is already in the project:

* **Components:** `@stacksjs/ui` (Stacks UI). Headless primitives + Craft native components + `Transition`. See [stacks-ui](../stacks-ui).
* **Styling:** Crosswind utilities + `dark:` variant. See [stacks-crosswind](../stacks-crosswind).
* **Icons:** Iconify `i-{collection}-{name}` classes (hugeicons default). No install needed.
* **Templating / reactivity / motion composables:** stx (see [stacks-stx](../stacks-stx)) and [stacks-composables](../stacks-composables).

Do NOT `npm install` Fluent, Carbon, Material, Radix, or shadcn into a Stacks app. Aesthetic directions (glassmorphism, bento, brutalism, editorial, aurora) are built with native CSS + Crosswind, not a package.

## Appendix B - Glassmorphism: honest web approximation (pure CSS)

Web glassmorphism is an approximation, not Apple's native Liquid Glass material (Apple documents that for Apple platforms only; there is no official web CSS package). Label it as an approximation in comments. This is pure CSS and retargeted to Crosswind: use utilities where they exist (`backdrop-blur`, `border-white/10`), and the `<style>` block for the layered highlights.

```css
/* web glassmorphism approximation (NOT Apple Liquid Glass) */
.glass-approx {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / .32);
  background:
    linear-gradient(135deg, rgb(255 255 255 / .30), rgb(255 255 255 / .08)),
    rgb(255 255 255 / .12);
  backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
  -webkit-backdrop-filter: blur(24px) saturate(180%) contrast(1.05);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / .48),
    inset 0 -1px 0 rgb(255 255 255 / .12),
    0 18px 60px rgb(0 0 0 / .18);
}

.glass-approx::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background:
    radial-gradient(circle at 20% 0%, rgb(255 255 255 / .55), transparent 34%),
    linear-gradient(90deg, rgb(255 255 255 / .18), transparent 42%, rgb(255 255 255 / .14));
  pointer-events: none;
}

.glass-approx::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  border: 1px solid rgb(255 255 255 / .14);
  pointer-events: none;
}

/* dark mode: pair with the Crosswind dark: variant at the call site if you prefer */
@media (prefers-color-scheme: dark) {
  .glass-approx {
    border-color: rgb(255 255 255 / .18);
    background:
      linear-gradient(135deg, rgb(255 255 255 / .16), rgb(255 255 255 / .04)),
      rgb(15 23 42 / .42);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / .22),
      0 18px 60px rgb(0 0 0 / .42);
  }
}

/* mandatory solid-fill fallback */
@media (prefers-reduced-transparency: reduce) {
  .glass-approx {
    background: rgb(255 255 255 / .96);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

**Important:** `prefers-reduced-transparency` has uneven browser support; test it. Always provide enough contrast even without blur. This is a labeled approximation, not an Apple-issued package.
