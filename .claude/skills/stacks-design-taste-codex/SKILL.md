---
name: stacks-design-taste-codex
description: Use when you need the stricter, Codex-oriented variant of stacks-design-taste for premium / anti-slop Stacks frontend work - award-level landing pages, portfolios, heroes, and marketing sections that demand high layout variance, deterministic scroll-driven motion, strict AIDA structure, wide editorial typography, and gapless bento grids. Ships stx + Crosswind + composables, tuned for the OpenAI Codex CLI as well as Claude Code.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Design Taste (Codex): Award-Level Design Engineering

Related skills: [stacks-design-taste](../stacks-design-taste) (the flagship anti-slop skill this refines), [stacks-design-soft](../stacks-design-soft), [stacks-design-minimalist](../stacks-design-minimalist), [stacks-design-brutalist](../stacks-design-brutalist), [stacks-image-to-code](../stacks-image-to-code), [stacks-stx](../stacks-stx) (templating, directives, signals, SSR/hydration), [stacks-crosswind](../stacks-crosswind) (utilities, dark mode, theming), [stacks-ui](../stacks-ui) (Craft native + headless components, Transition).

> This is the **stricter, Codex/GPT-oriented sibling** of [stacks-design-taste](../stacks-design-taste). It **composes with, and does not replace,** the flagship. Where the flagship reads the room and picks a direction, this variant clamps the dials higher, enforces AIDA page structure, forces real layout variance, and prescribes deterministic scroll-driven motion.
> **It defers to the flagship for shared rules** (the three dials, the full AI-Tells catalogue, the em-dash ban, the redesign protocol, the glassmorphism appendix). It does NOT restate all of them. When a rule here says "see the flagship," go read that section there rather than expecting a copy.
> Everything is built with **stx** templates + **Crosswind** utilities + **stx composables**. No JSX, no external motion library. Stacks ships NO motion library: never import `motion/react`, `gsap`, or `framer-motion`.
> Zero em-dashes anywhere in the output. Use the regular hyphen `-`. (Flagship Section 9.G, non-negotiable.)

---

## 0. CORE DIRECTIVE: BREAK THE STATISTICAL DEFAULTS

Standard LLMs carry severe layout biases: they generate 6-line wrapped headings inside narrow containers, leave dead empty cells in bento grids, print cheap meta-labels (`QUESTION 05`, `SECTION 01`), ship invisible button text, and repeat the same left/right split for every section. This variant exists to aggressively break those defaults.

Your outputs must be highly composed, mathematically clean in grid execution, motion-rich via CSS scroll-driven animation, and built on real, varied assets. Do NOT use emojis in code, comments, or visible text (flagship Section 3.D). Keep formatting strictly professional.

This skill is for **landing pages, portfolios, heroes, marketing and editorial sections** (flagship Section 13 defines what is out of scope: dashboards, dense data tables, multi-step product UI). If the brief is out of scope, say so and point at the right skill.

---

## 1. DIALS (Codex clamp)

Use the flagship's three dials verbatim: `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` (flagship Section 1). Do not invent aliases.

This variant **clamps the baseline higher** to fight the "first safe layout" bias:

* `DESIGN_VARIANCE`: minimum **8** unless the brief is trust-first / public-sector / accessibility-critical (then follow the flagship's inference table).
* `MOTION_INTENSITY`: minimum **6** for any landing / portfolio / agency brief. Motion is deterministic and scroll-driven, not decorative (Section 5).
* `VISUAL_DENSITY`: follow the flagship inference; editorial and premium briefs stay airy (3-4), cockpit data stays out of scope.

Still read the room first (flagship Section 0): declare the one-line **Design Read** and the dial values before any code. The clamp raises the floor; it never overrides an accessibility-first or trust-first brief.

---

## 2. DETERMINISTIC LAYOUT VARIANCE (BREAKING THE LOOP)

LLMs are lazy and always pick the first layout option, producing identical pages across briefs. This variant forces **real, computed variance** instead of a mental coin-flip.

**Compute the variance in a `<script server>` block**, using a deterministic seed (index-based or derived from the brief, e.g. the character length of the page title modulo the option count). The server block runs at SSR time, is stripped from the client bundle, and picks concrete architecture choices that the template then renders. This is the Stacks equivalent of "true randomization" - no Python, no `Math.random()` at render time (which would flicker on hydration), just a seeded, reproducible choice.

Before writing template markup, the server script MUST select:

* **1 Hero Architecture** (Section 3).
* **1 Typography Stack** (Geist, Satoshi, Cabinet Grotesk, Outfit, or a justified serif from the flagship's pool. **NEVER Inter** as default; override path in flagship Section 4.1).
* **3 unique Component Architectures** (Section 6). No family repeats (flagship Section-Layout-Repetition Ban).
* **2 scroll-driven Motion Paradigms** (Section 5).

You are forbidden from defaulting to the same composition twice across briefs. Follow the seeded selection your server script computed.

### 2.A Seeded variance - canonical skeleton (stx `<script server>` + directives)

```html
<!-- resources/views/landing.stx -->
<script server>
  // SSR-only: stripped from the client bundle. Seed is deterministic and
  // reproducible, so server and client agree (no hydration flicker).
  const { title = 'Untitled' } = props

  const heroLayouts = ['cinematic-center', 'artistic-asymmetry', 'editorial-split']
  const typeStacks = ['geist', 'satoshi', 'cabinet-grotesk', 'outfit']

  // index-based / content-derived seed, NOT Math.random()
  const seed = String(title).length
  const heroLayout = heroLayouts[seed % heroLayouts.length]
  const typeStack = typeStacks[(seed * 7) % typeStacks.length]
</script>

<template>
  @if(heroLayout === 'cinematic-center')
    <!-- Hero option 1 markup -->
  @elseif(heroLayout === 'artistic-asymmetry')
    <!-- Hero option 2 markup -->
  @else
    <!-- Hero option 3 markup -->
  @endif
</template>
```

Rules for this block: never `var`, never bare `document.*` / `window.*` (flagship Section 3.A, a CLAUDE.md rule). The seed drives a `@if / @elseif / @else` branch or a `:class` binding, so different briefs render genuinely different structures. Directive loops use `@foreach(items as index => item)` (no `$` sigil, no React `.map`).

---

## 3. AIDA STRUCTURE AND SPACING (strict)

Every page MUST open with a premium, non-generic **navigation bar** (floating glass pill, or a minimal split nav) and then follow AIDA:

* **Attention (Hero):** cinematic, clean, wide (Section 3.A).
* **Interest (Features / Bento):** high-density gapless grid or interactive typographic component (Section 4).
* **Desire (Scroll / Media):** pinned sticky-stack, horizontal-pan, or scrubbed text-reveal - all CSS scroll-driven (Section 5).
* **Action (Pricing / Footer):** massive high-contrast CTA and a clean footer.

**SPACING RULE:** large vertical padding between major sections (`py-32 md:py-48` at low density; scale down for `VISUAL_DENSITY > 5`). Sections read as distinct cinematic chapters. Do not cramp elements.

The nav still obeys the flagship hard rules: single line at desktop, height <= 80px, condense or collapse to a Stacks UI `Disclosure` / `Menu` at `lg` rather than wrapping to two lines.

### 3.A HERO ARCHITECTURE AND THE 2-LINE IRON RULE

The hero must breathe. It must NOT be a narrow 6-line text wall.

* **Container width fix:** use ultra-wide containers for the H1 (`max-w-5xl`, `max-w-6xl`, or `w-full`). Let the words flow horizontally.
* **Line limit (IRON RULE):** the H1 MUST NEVER exceed 2 to 3 lines. 4, 5, or 6 lines is a catastrophic failure. Fix by making the font size smaller (`text-[clamp(3rem,5vw,5.5rem)]`) and the container wider, never by narrowing the column.
* **Hero layout options (seeded via Section 2):**
  1. *Cinematic Center (preferred):* text centered, massive width, exactly two high-contrast CTAs below, a full-bleed background image with a dark radial wash behind everything.
  2. *Artistic Asymmetry:* text offset left, an artistic floating image overlapping from the bottom right.
  3. *Editorial Split:* text left, image right, with massive negative space.
* **Button contrast:** dark background = light text, light background = dark text. Invisible text is a Pre-Flight Fail (flagship Button Contrast Check, WCAG AA).
* **BANNED IN HERO:** floating stamp / badge icons on the text; pill-tags under the hero; raw data / stats in the hero. Also the flagship hero-stack discipline applies: max 4 text elements, no tagline strip below CTAs, "Used by" logo wall lives UNDER the hero.

The flagship hero discipline (fits initial viewport, `pt-24` top-padding cap, `min-h-[100dvh]` never `h-screen`, font scale planned around the asset) is binding here too.

---

## 4. THE GAPLESS BENTO GRID (strict)

* **Zero empty space in grids:** LLMs leave blank dead cells. Apply Crosswind `grid-flow-dense` (`grid-auto-flow: dense`) on every bento grid, and mathematically verify that `col-span-*` and `row-span-*` values interlock with no missing corner or void.
* **Exact cell count:** a bento grid has EXACTLY as many cells as you have content for. 3 items -> 3 cells, 5 items -> 5 cells (flagship BENTO CELL COUNT RULE). Never paste a blank tile to fill.
* **Card restraint:** 3 to 5 intentional, well-styled cells beat 8 messy ones. Fill them with a mix of real imagery, dense typography, or CSS effects.
* **Background diversity:** at least 2-3 cells need real visual variation (a real image, a brand-appropriate gradient that is NOT AI-purple, a pattern, a tinted fill), never 6 white-on-white text cards (flagship Section 4.7).
* Grid over flex-math: use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`), never `w-[calc(33%-1rem)]`. Declare the `< 768px` single-column collapse in the same component.

---

## 5. SCROLL-DRIVEN MOTION AND HOVER PHYSICS (deterministic, no library)

Static interfaces are forbidden at `MOTION_INTENSITY > 4`. **Stacks ships NO motion library**: never import `gsap`, `motion/react`, or `framer-motion`. Every effect the source expressed as a GSAP ScrollTrigger is retargeted to **CSS scroll-driven animations** (`animation-timeline: view()` / `scroll()`) plus `position: sticky; top: 0`, with reduced-motion gating. Observing state (enter-on-scroll) uses composables. This variant leans deterministic: prefer pure-CSS timelines over script wherever the effect can be expressed as one.

Retarget map (source GSAP paradigm -> Stacks mechanic):

| Source (GSAP ScrollTrigger) | Stacks retarget |
|---|---|
| Scroll pinning (`pin: true`) | `position: sticky; top: 0` + CSS `view()` / `scroll()` timeline |
| Card stacking on scroll | sticky-stack: each card `position: sticky; top: 0`, `view()` timeline shrinks/fades it (Section 5.A) |
| Horizontal scroll hijack | pinned sticky viewport + `scroll()` timeline panning the track (Section 5.B) |
| Image scale-and-fade on scroll | CSS `view()` timeline animating `transform: scale()` + `opacity` |
| Scrubbing text reveal | word `<span>`s with per-word `view()` timeline scrubbing `opacity` |
| Hover physics | Crosswind `group-hover:scale-105 transition-transform duration-700 ease-out` inside `overflow-hidden` |

Motion must be motivated (flagship Section: hierarchy, storytelling, feedback, or state transition, articulable in one sentence) and honor `prefers-reduced-motion` for anything above `MOTION_INTENSITY 3`. Marquees: max one per page.

**Hover physics:** every clickable card and image reacts. Wrap the media in `overflow-hidden` and scale the inner element on `group-hover` with a long, eased transition. Animate ONLY `transform` and `opacity`.

**Scroll pinning (retargeted split):** pin a section title (`position: sticky; top: 0`) while a gallery scrolls past. See 5.A / 5.B for the canonical skeletons.

**Image scale and fade:** images start small (`scale(0.8)`), grow to `scale(1)` as they enter, darken and fade (`opacity: 0.2`) as they exit - all on a `view()` timeline.

**Scrubbing text reveals:** central paragraph words start at `opacity: 0.1` and scrub to `1` sequentially as the user scrolls, driven by per-word `view()` timelines (Section 5.C).

**Card stacking:** cards overlap and stack from the bottom as the user scrolls - a real sticky-stack, not a sequential reveal list (Section 5.A).

The full canonical skeletons live in the flagship: **sticky-stack (Section 5.A), horizontal-pan (Section 5.B), scroll-reveal stagger with `useIntersectionObserver` (Section 5.C), pointer/magnetic via `useMouse()` -> CSS custom property inside an `effect` (Section 5.D), and Forbidden Animation Patterns (Section 5.E)**. Use them as written. This variant only adds the extra deterministic paradigms below.

### 5.A Scale-and-fade on scroll - canonical skeleton (pure CSS `view()` timeline)

```html
<!-- resources/components/scroll-media.stx -->
<template>
  <figure class="scroll-media">
    <img src="{{ src }}" alt="{{ alt }}" width="1600" height="1000" class="h-full w-full object-cover" />
  </figure>
</template>

<style>
  .scroll-media {
    animation: media-scale linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 50%;
    will-change: transform, opacity;
  }
  @keyframes media-scale {
    from { transform: scale(0.8); opacity: 0.2; }
    to   { transform: scale(1);   opacity: 1;   }
  }
  @media (prefers-reduced-motion: reduce) {
    .scroll-media { animation: none; transform: none; opacity: 1; }
  }
</style>
```

### 5.B Scrubbed text reveal - canonical skeleton (per-word `view()` timeline)

Split the paragraph into word `<span>`s (via a `@foreach` over pre-split words in the server block) and let each word scrub its own opacity. No `window` listeners, no per-frame signal writes.

```html
<!-- resources/components/scrub-text.stx -->
<script server>
  const { text = '' } = props
  const words = String(text).split(' ')
</script>

<template>
  <p class="scrub-text max-w-[65ch] text-2xl leading-relaxed">
    @foreach(words as index => word)
      <span class="scrub-word" style="--i: {{ index }}">{{ word }} </span>
    @endforeach
  </p>
</template>

<style>
  .scrub-word {
    opacity: 0.12;
    animation: scrub-in linear both;
    animation-timeline: view();
    /* each word starts a little later along the reveal */
    animation-range: entry calc(var(--i) * 1%) cover 40%;
  }
  @keyframes scrub-in { to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .scrub-word { animation: none; opacity: 1; }
  }
</style>
```

Critical points: the words are split server-side, the reveal is a pure CSS `view()` timeline staggered by `--i`, and reduced motion shows all words immediately. No library, no scroll listener.

For pointer / magnetic physics, drive a CSS custom property from `useMouse()` inside an `effect` exactly as the flagship Section 5.D skeleton shows. Never write signal state per pointer or scroll frame.

### 5.C Forbidden (hard bans, same as flagship 5.E)

* `window.addEventListener('scroll', ...)` - banned. Use CSS scroll-driven animations or `useIntersectionObserver` / `useElementVisibility`.
* Bare `window.*` / `document.*` / `var` in any stx `<script>` - banned. Use composables (`useEventListener`, `useWindow`, `useResizeObserver`, `useMouse`, `useScroll`, `useParallax`, `usePreferredReducedMotion`).
* `requestAnimationFrame` loops that write signal state on every frame - banned. Drive one CSS custom property per frame from inside an `effect`, or let a CSS timeline do it.
* Custom scroll-progress math written into signal state - banned. Use a `scroll()` timeline, or `useScroll()` reading into a CSS var.

Allowed composables are the flagship's list PLUS `useScroll` (scroll progress), `useParallax` (parallax offset), and `usePreferredReducedMotion` (reduced-motion signal, the composable form of `useMediaQuery('(prefers-reduced-motion: reduce)')`). Do NOT invent any others; if you need something else, use plain CSS / a standard web API through a composable and defer to [stacks-composables](../stacks-composables).

---

## 6. COMPONENT ARSENAL AND CREATIVITY

Select components from this arsenal per the seeded selection (Section 2). All are stx + Crosswind + composables / CSS, never a JS library.

* **Inline typography images:** embed small pill-shaped images directly INSIDE massive headings. Example: `I shape <span class="inline-block w-24 h-10 rounded-full align-middle bg-cover bg-center mx-2" style="background-image: url({{ shot }})"></span> digital spaces.` (Interpolation is `{{ }}`; `class` is the attribute; the inline style uses a CSS `url(...)`.)
* **Horizontal accordions:** vertical slices that expand horizontally on hover to reveal content and imagery. Reach for Stacks UI `Disclosure` when the state must be controllable; pure CSS `:hover` width transition otherwise.
* **Infinite marquee (trusted partners):** a smooth continuously scrolling row of real brand logos (Simple Icons / Iconify brand collection, `i-logos-*` / `i-simple-icons-*`) or large typography, via a CSS keyframe translate. Max one marquee per page (flagship rule).
* **Feedback / testimonial carousel:** overlapping portrait images next to minimalist quote typography, controlled by subtle arrows. Quote body max 3 lines, attribution is name + role + company, no em-dash (flagship Section 4.10).

Icons are Iconify utility classes only: `<i class="i-hugeicons-{name} h-6 w-6"></i>` or any collection `i-{collection}-{name}`. hugeicons is the default; keep one collection per project. NEVER hand-roll SVG icon paths, NEVER `npm install lucide-react` / `@phosphor-icons/*`.

---

## 7. CONTENT, ASSETS AND STRICT BANS

* **Meta-label ban:** BANNED FOREVER are `SECTION 01`, `SECTION 04`, `QUESTION 05`, `ABOUT US`-style cheap labels. Remove them entirely. The section's location and headline already categorize it. (This is the flagship EYEBROW RESTRAINT rule taken to its strict limit: max 1 eyebrow per 3 sections, and prefer zero.)
* **Image context and style:** use `https://picsum.photos/seed/{descriptive-seed}/1920/1080` and match the seed to the vibe. If an image-generation tool is available in the environment, use it FIRST for section-specific assets (flagship Section 4.8 priority order). Apply sophisticated CSS filters (`grayscale`, `mix-blend-luminosity`, `opacity-90`, `contrast-125`) so images do not read as boring stock. Serve with `<img>` + explicit `width`/`height` (reserve space, avoid CLS); heavy assets go through the stx asset pipeline / `@stacksjs/storage`. There is no `next/image`.
* **Fonts (Stacks):** declare metadata in the Stacks `fonts` config, then load in the layout `.stx` `<head>` with `<link rel="preconnect">` + stylesheet, or self-host with `@font-face`. Always `font-display: swap`. Never block render on a webfont. There is no `next/font`. Keep the flagship Inter-ban and serif discipline: sans display by default; serif only with explicit brand justification (never Fraunces or Instrument_Serif as default).
* **Creative backgrounds:** inject subtle professional ambient design (deep radial blurs, grainy mesh gradients built from layered radial gradients in a `<style>` block, shifting dark overlays). Avoid flat boring fills. Apply grain / noise ONLY on a fixed `pointer-events-none` pseudo-element, never on scrolling containers (flagship Section 6.E).
* **Horizontal-scroll bug guard:** wrap the whole page in `<main class="overflow-x-hidden w-full max-w-full">` to prevent horizontal scrollbars from off-screen animation.
* **Div-based fake screenshots are banned.** Use a real screenshot, a generated image, a real component preview, or skip the preview. The hero needs a real visual, not a gradient blob.
* **Copy self-audit** (flagship Section 4.9) and the **full AI-Tells catalogue** (flagship Section 9, including the complete em-dash ban 9.G) are binding. This variant does not restate them; go apply them from the flagship.

---

## 8. MANDATORY PRE-FLIGHT `<design_plan>` (binding gate)

Before writing ANY stx / UI code, output a `<design_plan>` block. This is not optional; skipping it is a failure.

1. **Seeded variance execution:** show the deterministic selection your `<script server>` seed computed (Hero layout, typography stack, 3 component architectures, 2 scroll-driven motion paradigms) and the seed value it derived from. No `Math.random()`.
2. **AIDA check:** confirm the page contains Navigation, Attention (Hero), Interest (Bento), Desire (scroll-driven section), Action (CTA / Footer).
3. **Hero math verification:** state the exact `max-w-*` class on the H1 that GUARANTEES it flows in 2-3 lines, and confirm NO stamp icons or spam tags exist in the hero.
4. **Bento density verification:** prove that `col-span` / `row-span` values leave zero empty cells and `grid-flow-dense` is applied, with exact cell count = content count.
5. **Label sweep and button check:** confirm no cheap meta-labels (`QUESTION 05`), eyebrow count <= ceil(sectionCount / 3), and every CTA passes contrast (no invisible button text).

Only output the UI code after this verification is complete.

---

## 9. FINAL PRE-FLIGHT CHECK

Run the flagship's **FINAL PRE-FLIGHT CHECK (Section 14) in full** - it is binding here and not restated. This variant ADDS the following strict gates on top. If any box fails, the output is not done.

- [ ] **`<design_plan>` block output** (Section 8) before any code, with all 5 verifications?
- [ ] **Variance computed in a `<script server>` seed**, not a mental coin-flip, and the template branches on it (`@if / @elseif / @else` or `:class`)?
- [ ] **No two briefs render the same composition**: hero architecture + type stack + component families are seeded, not defaulted?
- [ ] **AIDA structure present**: premium nav, then Attention / Interest / Desire / Action?
- [ ] **Hero H1 is 2-3 lines max** via an ultra-wide `max-w-*` container, never a narrow 4-6 line wall?
- [ ] **Bento grid is gapless**: `grid-flow-dense` applied, spans interlock, exact cell count, no dead cell?
- [ ] **Every GSAP-style effect retargeted** to a CSS scroll-driven timeline (`view()` / `scroll()`) + `position: sticky; top: 0`, reduced-motion gated - ZERO `gsap` / `motion/react` / `framer-motion` imports?
- [ ] **No `window.addEventListener('scroll')`, no per-frame signal-state scroll math, no `var` / bare `document.*` / `window.*`** in any stx script?
- [ ] **Only allowed composables** used (flagship list + `useScroll` / `useParallax` / `usePreferredReducedMotion`), no invented APIs?
- [ ] **Meta-label ban honored**: no `SECTION 01` / `QUESTION 05`, eyebrow count <= ceil(sectionCount / 3)?
- [ ] **Page wrapped in `overflow-x-hidden w-full max-w-full`** to guard against horizontal-scroll bugs?
- [ ] **ZERO em-dashes** anywhere (flagship 9.G)? Hyphens only in this file's dogfood and in all output.
- [ ] **Icons are Iconify `i-*` classes** (hugeicons default), no hand-rolled SVG, no icon npm package?

If a single box cannot be honestly ticked, fix it before delivering.
