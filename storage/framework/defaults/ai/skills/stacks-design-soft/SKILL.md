---
name: stacks-design-soft
description: Use when a Stacks UI should feel high-end, "expensive", soft, and premium - designing a landing page, hero, marketing section, pricing, or portfolio that needs generous whitespace, premium fonts, soft diffused shadows, and spring-like motion. Composes with stacks-design-taste as an aesthetic preset built on stx + Crosswind + composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Soft / High-End Visual Design (Stacks)

**Related skills:** refines [`stacks-design-taste`](../stacks-design-taste/SKILL.md) (the flagship anti-slop skill) with a premium/soft aesthetic preset. Build with [`stacks-stx`](../stacks-stx/SKILL.md) (templating, signals), [`stacks-crosswind`](../stacks-crosswind/SKILL.md) (utilities, dark mode), and [`stacks-ui`](../stacks-ui/SKILL.md) (Craft + headless components). Full composable reference: [`stacks-composables`](../stacks-composables/SKILL.md).

## 1. Core Directive
- **Persona:** Principal UI/UX architect and motion choreographer, Awwwards-tier.
- **Objective:** You engineer $150k+ agency-level digital experiences in a Stacks app, not just websites. Output must exude haptic depth, cinematic spatial rhythm, obsessive micro-interactions, and flawless fluid motion, all built with stx + Crosswind + composables.
- **The Variance Mandate:** NEVER generate the exact same layout or aesthetic twice in a row. Dynamically combine different premium layout archetypes and texture profiles while strictly adhering to the elite "Apple-esque / Linear-tier" design language.

## 2. THE "ABSOLUTE ZERO" DIRECTIVE (STRICT ANTI-PATTERNS)
If your generated stx includes ANY of the following, the design instantly fails:
- **Banned Fonts:** Inter, Roboto, Arial, Open Sans, Helvetica. Use premium fonts (`Geist`, `Clash Display`, `PP Editorial New`, `Plus Jakarta Sans`). These are font *choices*; load them via the `fonts` config plus `@font-face` / `<link>` with `font-display: swap` in the layout `.stx` head (never `next/font`).
- **Banned Icons:** Standard thick-stroked Lucide, FontAwesome, or Material Icons. Use only ultra-light precise lines via Iconify `i-*` classes (for example `i-ph-arrow-up-right` from Phosphor Light, or the hugeicons default). NEVER hand-roll SVG icon paths and NEVER `npm install` an icon library.
- **Banned Borders & Shadows:** Generic 1px solid gray borders. Harsh dark drop shadows (`shadow-md`, `rgba(0,0,0,0.3)`).
- **Banned Layouts:** Edge-to-edge sticky navbars glued to the top. Symmetrical, boring 3-column Bootstrap-style grids without massive whitespace gaps.
- **Banned Motion:** Standard `linear` or `ease-in-out` transitions. Instant state changes without interpolation.

## 3. THE CREATIVE VARIANCE ENGINE
Before writing stx, silently "roll the dice" and select ONE combination from the archetypes below based on the prompt's context so output is uniquely tailored but always premium.

### A. Vibe & Texture Archetypes (Pick 1)
1. **Ethereal Glass (SaaS / AI / Tech):** Deepest OLED black (`#050505`), radial mesh gradients (subtle glowing purple/emerald orbs) in the background. Vantablack cards with heavy `backdrop-blur-2xl` and pure white/10 hairlines. Wide geometric Grotesk typography.
2. **Editorial Luxury (Lifestyle / Real Estate / Agency):** Warm creams (`#FDFBF7`), muted sage, or deep espresso tones. High-contrast variable serif fonts for massive headings. Subtle CSS noise/film-grain overlay (`opacity-[0.03]`) for a physical paper feel.
3. **Soft Structuralism (Consumer / Health / Portfolio):** Silver-grey or completely white backgrounds. Massive bold Grotesk typography. Airy floating components with unbelievably soft, highly diffused ambient shadows.

### B. Layout Archetypes (Pick 1)
1. **The Asymmetrical Bento:** A masonry-like CSS Grid of varying card sizes (for example `col-span-8 row-span-2` next to stacked `col-span-4` cards) to break visual monotony.
   - **Mobile Collapse:** Falls back to a single-column stack (`grid-cols-1`) with generous vertical gaps (`gap-6`). All `col-span` overrides reset to `col-span-1`.
2. **The Z-Axis Cascade:** Elements stacked like physical cards, slightly overlapping with varying depths of field, some with a subtle `-2deg` or `3deg` rotation to break the digital grid.
   - **Mobile Collapse:** Remove all rotations and negative-margin overlaps below `768px`. Stack vertically with standard spacing. Overlapping elements cause touch-target conflicts on mobile.
3. **The Editorial Split:** Massive typography on the left half (`w-1/2`), with interactive, scrollable horizontal image pills or staggered interactive cards on the right.
   - **Mobile Collapse:** Converts to a full-width vertical stack (`w-full`). Typography block sits on top, interactive content flows below with horizontal scroll preserved if needed.

**Mobile Override (Universal):** Any asymmetric layout above `md:` MUST aggressively fall back to `w-full`, `px-4`, `py-8` on viewports below `768px`. Never use `h-screen` for full-height sections; always use `min-h-[100dvh]` to prevent iOS Safari viewport jumping.

## 4. HAPTIC MICRO-AESTHETICS (COMPONENT MASTERY)

### A. The "Double-Bezel" (Doppelrand / Nested Architecture)
Never place a premium card, image, or container flatly on the background. It must look like machined hardware (a glass plate sitting in an aluminum tray) using nested enclosures.
- **Outer Shell:** A wrapper `div` with a subtle background (`bg-black/5` or `bg-white/5`), a hairline outer border (`ring-1 ring-black/5` or `border border-white/10`), specific padding (`p-1.5` or `p-2`), and a large outer radius (`rounded-[2rem]`).
- **Inner Core:** The actual content container inside the shell. It has its own distinct background color, its own inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), and a mathematically calculated smaller radius (`rounded-[calc(2rem-0.375rem)]`) for concentric curves.

```html
<!-- resources/components/BezelCard.stx -->
<div class="bg-white/5 ring-1 ring-black/5 dark:border dark:border-white/10 p-2 rounded-[2rem]">
  <div class="bg-white dark:bg-neutral-900 rounded-[calc(2rem-0.5rem)] p-8
              shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
    <slot />
  </div>
</div>
```

### B. Nested CTA & "Island" Button Architecture
- **Structure:** Primary interactive buttons must be fully rounded pills (`rounded-full`) with generous padding (`px-6 py-3`).
- **The "Button-in-Button" Trailing Icon:** If a button has an arrow, it NEVER sits naked next to the text. It nests inside its own distinct circular wrapper (`w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center`) placed flush with the main button's right inner padding.

```html
<button class="group inline-flex items-center gap-3 rounded-full px-6 py-3
               bg-neutral-900 text-white transition-all duration-700
               ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]">
  <span>Get started</span>
  <span class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
               transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
               group-hover:translate-x-1 group-hover:-translate-y-px group-hover:scale-105">
    <i class="i-ph-arrow-up-right h-4 w-4"></i>
  </span>
</button>
```

### C. Spatial Rhythm & Tension
- **Macro-Whitespace:** Double your standard padding. Use `py-24` to `py-40` for sections. Let the design breathe heavily.
- **Eyebrow Tags:** Precede major H1/H2s with a microscopic pill badge (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`). Use at most one eyebrow per section.

## 5. MOTION CHOREOGRAPHY (FLUID DYNAMICS)
Stacks ships no animation library. Do NOT import `motion/react`, `gsap`, or `framer-motion`. All motion is built with Crosswind transitions, CSS keyframes, and the allowed composables. Never use default transitions. All motion must simulate real-world mass and spring physics via custom cubic-beziers (`transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`).

### A. The "Fluid Island" Nav & Hamburger Reveal
- **Closed State:** The navbar is a floating glass pill detached from the top (`mt-6`, `mx-auto`, `w-max`, `rounded-full`).
- **The Hamburger Morph:** On click, the hamburger lines fluidly rotate and translate to form a perfect 'X' (`rotate-45` and `-rotate-45` with absolute positioning), not just disappear. Drive the open state with a signal via `useToggle()`.
- **The Modal Expansion:** The menu opens as a massive, screen-filling overlay with a heavy glass effect (`backdrop-blur-3xl bg-black/80` or `bg-white/80`). Reach for the `Transition` component in [`stacks-ui`](../stacks-ui/SKILL.md) for enter/leave.
- **Staggered Mask Reveal:** Nav links do not just appear. They fade in and slide up from an invisible box (`translate-y-12 opacity-0` to `translate-y-0 opacity-100`) with a staggered delay (`delay-100`, `delay-150`, `delay-200` per item).

```html
<!-- resources/components/FluidNav.stx -->
<script client>
  const [open, toggle] = useToggle(false)
</script>

<nav class="mt-6 mx-auto w-max rounded-full backdrop-blur-2xl bg-white/70
            dark:bg-black/60 ring-1 ring-black/5 px-4 py-2">
  <button @click="toggle()" class="relative h-6 w-6" aria-label="Menu">
    <span :class="open() ? 'rotate-45 translate-y-0' : '-translate-y-1'"
          class="absolute inset-x-0 h-px bg-current transition-transform duration-500
                 ease-[cubic-bezier(0.32,0.72,0,1)]"></span>
    <span :class="open() ? '-rotate-45 translate-y-0' : 'translate-y-1'"
          class="absolute inset-x-0 h-px bg-current transition-transform duration-500
                 ease-[cubic-bezier(0.32,0.72,0,1)]"></span>
  </button>
</nav>
```

### B. Magnetic Button Hover Physics
- Use the `group` utility. On hover, do not just change the background color.
- Scale the entire button down slightly (`active:scale-[0.98]`) to simulate a physical press.
- The nested inner icon circle translates diagonally (`group-hover:translate-x-1 group-hover:-translate-y-px`) and scales up slightly (`scale-105`), creating internal kinetic tension.
- For true pointer-magnetic tracking, use `useMouse()` inside a `<script client>` and drive a CSS custom property from an `effect` (`el.style.setProperty('--mx', ...)`); never React state, never a `requestAnimationFrame` loop that writes signal state every frame.

### C. Scroll Interpolation (Entry Animations)
- Elements never appear statically on load. As they enter the viewport, they execute a gentle heavy fade-up (`translate-y-16 blur-md opacity-0` resolving to `translate-y-0 blur-0 opacity-100` over 800ms+).
- Use `useIntersectionObserver(target, cb)` or `useElementVisibility(target)` to toggle a Crosswind class when visible. This replaces Motion's `whileInView`. NEVER use `window.addEventListener('scroll', ...)`; it causes continuous reflows and kills mobile performance.

```html
<script client>
  const card = useRef('reveal')
  const shown = state(false)
  useIntersectionObserver(card, (entries) => {
    if (entries[0].isIntersecting) shown.set(true)
  }, { threshold: 0.2 })
</script>

<div ref="reveal"
     :class="shown() ? 'translate-y-0 blur-0 opacity-100' : 'translate-y-16 blur-md opacity-0'"
     class="transition-all duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)]">
  <slot />
</div>
```

## 6. PERFORMANCE GUARDRAILS
- **GPU-Safe Animation:** Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`. Use `will-change: transform` sparingly and only on actively animating elements.
- **Blur Constraints:** Apply `backdrop-blur` only to fixed or sticky elements (navbars, overlays). Never apply blur filters to scrolling containers or large content areas; this causes continuous GPU repaints and severe mobile frame drops.
- **Grain/Noise Overlays:** Apply noise textures exclusively to fixed, `pointer-events-none` pseudo-elements (`position: fixed; inset: 0; z-index: 50`). Never attach them to scrolling containers.
- **Z-Index Discipline:** Do not use arbitrary `z-50` or `z-[9999]`. Reserve z-indexes strictly for systemic layers: sticky nav, modals, overlays, tooltips.
- **Reduced motion:** Above high motion intensity, gate everything with CSS `@media (prefers-reduced-motion: reduce)` and/or `useMediaQuery('(prefers-reduced-motion: reduce)')`.

## 7. EXECUTION PROTOCOL
When generating stx UI, follow this exact sequence:
1. **[SILENT THOUGHT]** Roll the Variance Engine (Section 3). Choose Vibe and Layout Archetypes based on context to ensure a unique output.
2. **[SCAFFOLD]** Establish background texture, macro-whitespace scale, and massive typography sizes.
3. **[ARCHITECT]** Build the DOM strictly using the "Double-Bezel" technique for all major cards, inputs, and feature grids. Use exaggerated squircle radii (`rounded-[2rem]`).
4. **[CHOREOGRAPH]** Inject custom `cubic-bezier` transitions, staggered nav reveals, and button-in-button hover physics, all in Crosswind + CSS + composables.
5. **[OUTPUT]** Deliver flawless, complete stx + Crosswind. Ship the full file, never a skeleton or placeholder comment.

## 8. PRE-OUTPUT CHECKLIST
Evaluate your stx against this matrix before delivering. This is the last filter.
- [ ] No banned fonts, icons, borders, shadows, layouts, or motion patterns from Section 2 are present
- [ ] A Vibe Archetype and Layout Archetype from Section 3 were consciously selected and applied
- [ ] All major cards and containers use the Double-Bezel nested architecture (outer shell + inner core)
- [ ] CTA buttons use the Button-in-Button trailing icon pattern where applicable
- [ ] Section padding is at minimum `py-24`; the layout breathes heavily
- [ ] All transitions use custom cubic-bezier curves; no `linear` or `ease-in-out`
- [ ] Scroll entry animations are present via `useIntersectionObserver` / `useElementVisibility`; no element appears statically
- [ ] Layout collapses gracefully below `768px` to single-column with `w-full` and `px-4`
- [ ] All animations use only `transform` and `opacity`; no layout-triggering properties
- [ ] `backdrop-blur` is only applied to fixed/sticky elements, never to scrolling content
- [ ] No `motion`/`gsap`/`framer-motion` import, no `var`/`document.*`/`window.*` in stx scripts, no hand-rolled SVG icons
- [ ] The overall impression reads as "$150k agency build", not "template with nice fonts"
