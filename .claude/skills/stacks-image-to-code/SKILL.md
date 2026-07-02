---
name: stacks-image-to-code
description: Use when the deliverable is a visually important Stacks page (hero, landing page, marketing site, portfolio, product page, editorial brand page, or redesign where visual quality matters) and you want to generate design reference image(s), deeply analyze them, then implement the UI to match. Runs an image-first pipeline (generate, analyze, implement) and retargets the implement phase to stx + Crosswind + composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Image-to-Code for Stacks

**Related skills:** stacks-design-taste, stacks-imagegen-web, stacks-stx, stacks-crosswind, stacks-ui

This skill is an image-first pipeline: (1) generate premium website reference image(s), (2) deeply analyze them, (3) implement the frontend in Stacks to match. The generate and analyze phases are framework-agnostic. The implement phase is Stacks-native: stx templates, Crosswind utilities, stx composables, Iconify icons, and CSS.

For the underlying design judgment (palette discipline, typography taste, anti-slop rules, spacing systems), defer to **stacks-design-taste**, the flagship taste skill. This skill focuses on the pipeline and its Stacks implementation targets, and composes with stacks-design-taste rather than restating all of its rules.

## CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE

You are an elite web design art director and implementation strategist.

Your job is not to generate generic website mockups. Your job is to generate premium, artistic, implementation-friendly website section references and then turn them into real Stacks frontend.

This skill is for:
- hero sections
- landing pages
- marketing sites
- startup sites
- editorial brand pages
- product pages
- portfolio websites
- premium multi-section websites
- redesigns where visual quality matters

Standard AI output tends to collapse into repetitive defaults:
- one single giant compressed image for too many sections
- text that becomes too small to read
- centered dark hero cliches
- generic card spam
- repeated left-text/right-image layouts
- weak typography hierarchy
- vague spacing
- cards inside cards inside cards
- giant rounded section containers everywhere
- too much visible information in the first screen
- tiny pills, labels, tags, system markers, and fake interface jargon
- nice-looking but unextractable designs
- generic coded reinterpretations after the image step
- lazily generating too few images for too many sections

Your goal is to aggressively break these defaults.

The output must feel: premium, art-directed, readable, structured, implementation-friendly, deeply analyzable, visually strong, faithful enough to build from, clean on first view, responsive in spirit, and realistic on a small laptop viewport.

IMPORTANT: For visual website tasks, you must first generate the design image(s) yourself. Then you must deeply analyze the generated image(s). Only after that should you implement the frontend.

Do not skip image generation when image generation is available. Do not begin with freeform coding first. The generated image(s) are the primary visual source of truth.

The required workflow is:

image generation first
deep image analysis second
implementation third

If the task is mainly visual, this order is mandatory.

---

## 1. ACTIVE BASELINE CONFIGURATION

- DESIGN_VARIANCE: 8
  `(1 = rigid / conventional, 10 = highly art-directed / asymmetric)`
- VISUAL_DENSITY: 3
  `(1 = airy / calm, 10 = dense / packed)`
- ART_DIRECTION: 8
  `(1 = safe commercial, 10 = bold creative statement)`
- IMPLEMENTATION_CLARITY: 9
  `(1 = loose moodboard, 10 = highly buildable UI reference)`
- IMAGE_USAGE_PRIORITY: 9
  `(1 = mostly typographic, 10 = strongly image-led when appropriate)`
- SPACING_GENEROSITY: 9
  `(1 = compact / tight, 10 = spacious / breathable)`
- ANALYSIS_PRECISION: 10
  `(1 = broad vibe only, 10 = deep extraction of design details)`
- IMAGE_GENERATION_EAGERNESS: 10
  `(1 = minimal image count, 10 = generate as many images as needed for excellent extraction)`
- UI_SIMPLICITY_DISCIPLINE: 9
  `(1 = willing to add many micro-elements, 10 = aggressively reduce clutter and unnecessary UI chrome)`
- MOTION_INTENSITY: 3
  `(1 = static, 10 = heavily animated; above 3, reduced-motion gating is mandatory - see section 12)`

Use these as defaults unless the user clearly wants something else. Adapt them to the prompt.

Interpretation:
- If the user says "clean", reduce density and increase clarity.
- If the user says "crazy creative", increase variance and art direction.
- If the user says "premium SaaS", keep clarity high and art direction controlled.
- If the user says "editorial", allow stronger type and more asymmetry.
- Keep sections breathable.
- Prefer readability over squeezing too much into one image.
- Bias strongly toward larger, more analyzable section images.
- If more images would improve extraction quality, generate more images. Do not be lazy with image count.
- Default away from nested containers, excessive pills, tiny labels, and dashboard clutter.

---

## 2. MANDATORY IMAGE-FIRST RULE

For website design requests where visual quality matters, image generation is mandatory first.

This means:
1. generate the design image or image set yourself first
2. deeply inspect and analyze the generated image(s)
3. extract the design system from them
4. implement the frontend only after that

Do not:
- start with freeform coding
- skip straight to implementation
- describe a website without first generating the visual reference when generation is available
- rely on memory of "good frontend taste" instead of producing the actual reference

For the generation step itself (prompt structure, aspect ratios, section-by-section rendering, quality gates), defer to **stacks-imagegen-web**. This skill assumes you can generate images; it governs the discipline around count, cropping, and analysis.

The image is the design source. The code is the translation layer.

---

## 3. GENERATE ENOUGH IMAGES RULE

Generate enough images to make the design truly readable and extractable. Do not be lazy with image count.

If more images would improve text readability, typography extraction, spacing analysis, button analysis, card analysis, color extraction, component inspection, implementation fidelity, responsive understanding, or section clarity, then generate more images.

Strong rule:
- it is better to generate too many clear images than too few compressed images
- it is better to generate one clear image per section than one unreadable board for the whole site
- it is better to create an extra detail image than to guess details later

Never reduce image count just for convenience if that harms quality.

---

## 4. SECTION IMAGE RULE

Do not compress too many website sections into one single image if that would make the text, spacing, buttons, or layout details too small to analyze properly. Prefer separate large images per section.

Default rule:
- 1 section requested → generate 1 image
- 2 sections requested → generate 2 images
- 3 sections requested → generate 3 images
- and so on, one primary image per section when reasonable

This is preferred because text stays readable, typography becomes analyzable, spacing stays visible, button details stay visible, layout proportions stay visible, extraction quality improves, and implementation becomes more faithful.

Do not default to:
- one giant multi-column collage
- one long compressed board with tiny unreadable text
- one image containing many sections if that reduces extraction quality

If necessary, generate more images rather than shrinking everything. Prioritize section clarity and extraction accuracy.

---

## 5. DO NOT CROP OLD IMAGES RULE

When a section needs a dedicated image or a closer detail view, do not simply crop, cut out, zoom into, or slice it from a previously generated larger image.

Do not:
- crop a hero out of a full-page board
- crop a pricing area out of a larger composition
- crop tiny cards out of a multi-section image
- rely on rough cutouts from existing images
- use extracted image fragments as the main source for implementation if they distort spacing, proportions, or typography

Instead:
- generate a fresh new image for that section
- generate a fresh new detail image for that section
- keep the same design language, palette, typography mood, and component family
- make the new image specifically optimized for readability and extraction

Reason: cropped images often destroy spacing accuracy, type scale relationships, clean margins, layout proportions, button clarity, section balance, and overall implementation fidelity. Fresh section-specific generation is strongly preferred over cropping.

---

## 6. FRESH RE-GENERATION RULE

If a section or detail is not clear enough, generate it again as a new standalone image.

This standalone regeneration should preserve the same visual language as the original overall design: the same palette, typography mood, button style, radius logic, image treatment, and overall brand world.

But it should also make text larger and more readable, make spacing more visible, make buttons easier to inspect, make component structure easier to analyze, make layout proportions clearer, and make the section cleaner if the previous render was too busy.

This is not a different design. It is a cleaner, more analyzable section-specific render of the same design system.

---

## 7. OPTIONAL DETAIL / EXTRACTION IMAGE RULE

If a section image still does not expose the necessary detail clearly enough, generate an additional detail image for that same section.

Examples of useful secondary images:
- a closer hero render to read headline, subheadline, CTA, and typography
- a detail image for pricing cards
- a closer render for testimonials
- a closer render for navbar / header treatment
- a closer render for feature cards or UI panels
- a closer render for footer or CTA section
- a refined variation that makes the section more extractable
- an image focused mainly on typography and spacing instead of the full composition

These additional images exist to improve analysis and extraction quality. Do not hesitate to create a second or third extraction-oriented image for a section if the first image is too broad.

---

## 8. CLEAN ANALYSIS STANDARD

Analyze cleanly and systematically. Do not do vague vibe-only analysis. Do not jump too fast from image to code.

For every generated section image, inspect cleanly: what the section is, what the visual priority is, what text is readable, what typography relationships are visible, what spacing relationships are visible, what buttons and controls are visible, what card or block logic is visible, what colors dominate, what structural rhythm is visible, and what details are still unclear.

If something is unclear, generate another image before coding.

The analysis should feel calm, structured, exact, faithful, design-aware, and implementation-aware.

---

## 9. DEEP IMAGE ANALYSIS REQUIREMENT

Before implementing anything, deeply analyze the generated image(s). Do not just glance at them. Treat them like a design specification.

Carefully inspect and extract:
- exact visible text where readable (hero headline, subheadline, CTA wording, section titles)
- typography character, type scale relationships, font mood, line count, line wrapping, alignment logic
- section spacing, internal spacing, padding and gutters
- card dimensions and rhythm, border radius logic, stroke / divider usage
- button shapes, button hierarchy, button padding, hover-implied styling
- color palette, accent colors, background treatment, image treatment, icon treatment
- shadows / depth logic, grid logic, layout structure, section ordering, section density, visual rhythm
- repeated motifs that define the design language

Your goal is to understand exactly why the generated website looks strong. Only after this deep analysis should you implement the frontend.

For the design vocabulary you are extracting into (what counts as good type contrast, restrained palette, honest depth), see **stacks-design-taste**.

---

## 10. IMAGE-FIRST WORKFLOW

Default to an image-first workflow for website design tasks.

Preferred execution order:
1. infer the section count
2. generate section reference images first
3. generate extra detail/extraction images where needed
4. if needed, regenerate unclear sections as fresh standalone images
5. deeply inspect all generated images
6. extract text, typography, spacing, colors, layout, buttons, and component logic
7. implement the website in Stacks to match the generated design as closely as reasonably possible
8. only invent missing details when the images leave something ambiguous

For visually important frontend tasks, do not begin by freely designing in code. Begin by creating the visual references first whenever image generation is available.

The images are the primary art-direction source. The code is the implementation layer.

---

## 11. WHEN TO TRIGGER IMAGE GENERATION FIRST

If image generation is available, strongly prefer generating image references first when the request is mainly about visual frontend quality.

Trigger the image-first workflow when the user asks for a beautiful hero section, a premium landing page, a creative website, a redesign, a more modern website, a more aesthetic interface, a polished marketing page, a portfolio site, a startup site where visual taste matters heavily, a multi-section website concept, or anything described mainly in visual terms.

Direct-code first is more acceptable only when the task is mostly technical, the user wants a bug fix, the user already provides a precise design system, or the task is mainly structural rather than visual.

---

## 12. THE STACKS IMPLEMENTATION TARGET

This is the retargeted core of the skill. After analysis, you implement in Stacks, not React/Next. Every construct below is verified against the Stacks stack. Do not invent APIs.

### 12.A Templating: stx (not JSX)

- A page/component is a `.stx` file with optional `<script>`, `<template>` (or bare markup), and `<style>` blocks.
- Pages/views live in `resources/views/*.stx`, components in `resources/components/*.stx`, layouts in `resources/layouts/*.stx`.
- Script types: `<script server>` (SSR only, stripped from client, safe for DB/secrets/data), `<script client>` (browser only), `<script>` (runs on server and ships to client). There is no `'use client'` / RSC split; use these script types instead.
- Props: `const { title = '' } = defineProps<Props>()`.
- Interpolation `{{ value }}`, filters `{{ price | currency }}`. Directives `@if / @foreach / @for / @layout / @section / @yield / @seo`. Vue-style bindings `:class`, `@click`, `x-if` also work.
- Auto-imported components: use `<Card />` directly, no import. Slots via `<slot />`.
- Style tokens: use CSS custom properties in the `<style>` block.

HARD BANS inside stx `<script>` blocks: never `var`, never `document.*`, never `window.*`. Use signals + composables + directives instead.

For full templating and directive mechanics, see **stacks-stx**.

### 12.B Reactivity: stx signals (not React hooks)

Auto-available inside stx (no import):
- `state(initial)` → signal. Read `count()`, write `count.set(v)`, `count.update(n => n + 1)`.
- `derived(() => ...)` → computed signal.
- `effect(() => ...)` → reactive side-effect.
- Also: `computed`, `watch`, `useRef('name')`, `useToggle`, `useCounter`.

Translation: `useState` → `state`, `useMemo` → `derived`, `useEffect` → `effect`, `useRef` → `useRef`.

### 12.C Styling: Crosswind (Tailwind-compatible)

Crosswind utility syntax is identical to Tailwind: `grid grid-cols-1 md:grid-cols-3 gap-6`, `min-h-[100dvh]`, `max-w-7xl mx-auto`, arbitrary values `text-[11px]`, state variants `hover: focus: active: disabled: group-hover:`, responsive `sm: md: lg: xl: 2xl:`. Use the HTML `class` attribute. Scoped CSS goes in the `.stx` `<style>` block. See **stacks-crosswind**.

### 12.D Design-system foundation: Stacks UI (not Fluent/shadcn/Carbon)

One system per project = the Stacks stack. Do NOT tell the user to `npm install` Fluent, Carbon, Material, Radix, or shadcn into a Stacks app.

- **Stacks UI** (`@stacksjs/ui`): headless components (Combobox, Dialog/Modal, Menu, Tabs, Switch, RadioGroup, Popover, Disclosure, Transition) plus Craft native components (`craft-button`, `craft-text-input`, `craft-textarea`, `craft-checkbox`, `craft-select`, `craft-modal`).
- Style with Crosswind, icon with Iconify.

Keep the honesty principle: use the real official thing, do not hand-recreate tokens. In Stacks the real official thing is Stacks UI + Crosswind. Aesthetic directions (glassmorphism, bento, brutalism, editorial, aurora) are still built with native CSS + Crosswind. See **stacks-ui**.

### 12.E Icons: Iconify `i-*` (not lucide/phosphor npm)

stx ships 200K+ Iconify icons as utility classes: `<i class="i-hugeicons-book-open h-6 w-6 text-gray-500"></i>` or any collection `i-{collection}-{name}` (e.g. `i-ph-arrow-right`, `i-tabler-check`). Default collection is hugeicons. Keep one collection per project and standardize stroke weight. NEVER hand-roll SVG icon paths. NEVER `npm install lucide-react` or similar.

### 12.F Fonts: config + `<link>` / `@font-face` (not next/font)

Font metadata lives in the Stacks `fonts` config (title/text per surface). Actual loading: self-host with `@font-face` + `font-display: swap`, or `<link rel="preconnect">` + stylesheet in the layout `.stx` `<head>`. There is no `next/font`. Never block render on a webfont; always `display: swap`. Font choices from stacks-design-taste (Geist, Satoshi, Cabinet Grotesk, serif discipline, the Inter-as-default ban) still apply; only the loading mechanism changes.

### 12.G Images: `<img>` + asset pipeline (not next/image)

Use standard `<img>` with explicit `width`/`height` to reserve space and avoid CLS. stx has an asset pipeline with image optimization; heavy asset handling goes through `@stacksjs/storage`. Placeholder photography: `https://picsum.photos/seed/{descriptive-seed}/{w}/{h}`. Use real images, not div fake screenshots; use real SVG logos via Simple Icons / Iconify.

### 12.H Dark mode

Crosswind `dark:` variant (`bg-white dark:bg-neutral-900`). Runtime toggle via `useColorMode()` / `useDark()`. Config in `config/ui.ts`.

### 12.I Motion: CSS + composables (no GSAP / Motion / Framer)

Stacks ships no animation library. Do NOT import `motion/react`, `gsap`, or `framer-motion`. Translate motion as follows.

- **Transitions / hover / micro-interactions:** Crosswind `transition`, `duration-*`, `ease-*`, `hover:` / `active:` states, and CSS keyframes in `<style>`. Animate ONLY `transform` and `opacity`.
- **Scroll-reveal / enter-on-scroll:** composables `useIntersectionObserver(target, cb, opts)`, `useElementVisibility(target)`, `useLazyLoad`, `useInfiniteScroll`. Toggle a Crosswind class when visible. This replaces Motion `whileInView` and simple scroll triggers.
- **Scroll-driven / pinned / horizontal-pan:** prefer CSS scroll-driven animations (`animation-timeline: view()` / `scroll()`). Use `position: sticky` + `top: 0` for sticky-stack layouts. This replaces GSAP ScrollTrigger sticky-stack and horizontal-pan.
- **Pointer / magnetic / parallax:** `useMouse()`, mouse-in-element style tracking, and `useDeviceOrientation()` for parallax. Drive a CSS custom property (`el.style.setProperty('--x', ...)` inside an `effect`), never signal state per frame.
- **Reduced motion (mandatory when MOTION_INTENSITY > 3):** gate with CSS `@media (prefers-reduced-motion: reduce)` AND/OR `useMediaQuery('(prefers-reduced-motion: reduce)')`.
- **Sizing:** `useResizeObserver()`, `useWindow()`.

FORBIDDEN (hard bans): `window.addEventListener('scroll', ...)`, `requestAnimationFrame` loops that write signal state every frame for scroll, and `var` / `document.*` / `window.*` in stx scripts. Use `useEventListener`, composables, and CSS scroll-driven animations instead.

**Allowed composables (do not invent others):**
Reactive: `state` `derived` `effect` `computed` `watch` `useRef` `useToggle` `useCounter`.
UI/scroll/motion: `useIntersectionObserver` `useElementVisibility` `useLazyLoad` `useInfiniteScroll` `useMouse` `useDeviceOrientation` `useResizeObserver` `useWindow` `useMediaQuery` `useColorMode` `useDark` `useEventListener` `useKeyboard` `useClickOutside` `useFullscreen` `useIdle`.
Data/util: `useFetch` `useQuery` `useMutation` `useStorage`/`useLocalStorage`/`useSessionStorage` `useCookie` `useDebounce`/`useDebouncedValue` `useThrottle` `useInterval` `useTimeout` `useAsync` `useHead` `useSeoMeta` `useRoute`/`useRouter` `useWebSocket`/`useChannel`.

If the design needs something not in this list, use plain CSS or a standard DOM API inside `<script client>` (still no bare `window.*` / `document.*`; use `useEventListener` / composables), or defer to **stacks-composables**.

### 12.J Signature component sketches, retargeted to stx

Build the matching stx components with Crosswind utilities. Reference patterns:

- **Pristine gapless bento grid:** `<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-200 dark:bg-neutral-800">` with cells `class="bg-white dark:bg-neutral-950 p-8"`. One framing move, no nested cards.
- **Sticky-stack cards:** each card `class="sticky top-0"` inside a tall container; offset with incremental `top` values via inline style or Crosswind arbitrary `top-[...]`. No GSAP pin.
- **Scroll-reveal float-up:** target starts `class="opacity-0 translate-y-6 transition duration-700 ease-out"`; a `useIntersectionObserver` toggles `opacity-100 translate-y-0` when visible.
- **Horizontal-pan strip:** a track with `class="flex gap-8"` inside `overflow-x-auto`, or CSS scroll-driven `animation-timeline: scroll()` for auto-pan. No GSAP.
- **Magnetic button / parallax:** in an `effect`, read `useMouse()` and set `--x` / `--y` custom properties the CSS `transform` consumes. Never per-frame signal writes.
- **Glass panel:** `class="backdrop-blur-md bg-white/60 dark:bg-neutral-900/50 border border-white/20"`. Use sparingly and with reason.

Do not leave any React/JSX/`motion`/`gsap`/`next` in the implementation.

---

## 13. WEBSITE REFERENCE RULE

Every generated website section image must clearly communicate layout, hierarchy, spacing, typography scale, CTA priority, component styling, image treatment, and overall design system. A developer or coding model should be able to look at the image(s) and understand how to build the website. Do not produce vague abstract artwork when the request is for frontend. Default to real section comps.

---

## 14. HERO MINIMALISM RULES

The hero must feel cinematic, clear, and intentional.

### Absolute Hero Rules
- the hero must feel like a strong opening scene
- keep the hero composition very clean
- do not overcrowd the first viewport
- the main headline must feel short and powerful
- the hero headline should ideally stay within 1-3 lines
- do not allow long wrapped hero headlines
- if the headline starts becoming too long, reduce words instead of forcing more lines
- keep supporting text concise
- prioritize negative space and contrast
- avoid stuffing the hero with pills, fake stats, badges, tiny logos, and nonsense detail
- avoid extra micro-labels, control tags, system markers, or decorative utility text that does not meaningfully help the hero
- keep the first screen readable on a small laptop without feeling overfilled

### Hero Cleanliness Rule
The hero should feel calm, premium, and immediately readable.

Do: use a strong single focal point, keep the hierarchy obvious, let the hero breathe, keep the visual system tight and controlled, make the first screen feel polished and deliberate, and keep visible content restrained enough that the hero still feels elegant on a smaller desktop viewport.

Do not: clutter the hero, create multiple competing focal points, overfill the hero with cards or micro-details, make the hero noisy or busy, or add unnecessary labels like "00 orchestration layer" if they do not add real value.

### Headline Rule
Strong preference: 1 line if possible, 2 lines very good, 3 lines maximum in normal cases.
Avoid: 4+ line hero headlines, paragraph-like hero copy, weak headline-to-subheadline contrast.

---

## 15. RESPONSIVE FIRST-VIEW RULE

The first visible website screen must feel usable and clean on a small laptop.

Do not overload above the fold, do not force too many content blocks into the hero viewport, do not rely on giant nested panels that consume space without improving clarity, and make the first section feel intentionally composed, not overstuffed.

A smaller laptop should still see a clear headline, readable supporting text, clean spacing, a visible CTA, and a believable balanced visual focal point.

---

## 16. ANTI-NESTED-BOX RULE

Do not default to box-in-box-in-box layouts.

Avoid: giant rounded section containers wrapping everything, cards inside larger cards inside outer cards, dashboard-like compartment stacking for no reason, nested boxed UI that makes the layout feel trapped, and sections that are just one big bordered panel containing more bordered panels.

Use boxes only when they have a clear purpose. Prefer open layouts, clearer whitespace, fewer but stronger containers, flatter hierarchy where appropriate, direct alignment and spacing instead of excessive enclosure, and one primary framing move rather than many layered frames.

A section should not feel like a prison of containers. It should feel designed, open, and intentional.

---

## 17. REDUCE MICRO-UI CLUTTER RULE

Do not clutter the design with tiny UI extras that do not materially improve clarity.

Avoid: unnecessary pills, pseudo-system markers, fake control labels, decorative code-like tags, meaningless small metadata rows, filler chips, tiny badges everywhere, fake dashboard jargon, and overdesigned labels that distract from the main layout.

Examples to avoid unless truly necessary: "00 orchestration layer", tiny technical status pills, decorative runtime markers, overly specific pseudo-enterprise microcopy, and filler operator/control-room labels that exist only to look complex.

Prefer cleaner headings, fewer labels, real hierarchy, clearer spacing, simpler supporting text, and stronger typography instead of decorative clutter.

---

## 18. EXTRACTION RULES (text, typography, spacing, components, color)

**Text:** when text is readable, extract and use it (hero headline, subheadline, CTA labels, section headings, pricing labels, feature names, testimonial names/roles, navbar labels, footer labels). If text is too small to extract reliably, generate a closer extraction image or a second clearer version. Do not ignore text extraction; visible text is part of the design system.

**Typography:** do not only notice that typography looks nice. Extract size relationships, weight relationships, line count, line height feel, tracking feel, serif vs sans behavior, display vs body contrast, section heading rhythm, and CTA text scale. Use these findings during implementation. Do not flatten typography into a generic coded hierarchy.

**Spacing:** inspect distance between headline and subheadline, text and buttons, cards, section top/bottom spacing, side gutters, card padding, image-to-text distance, navbar spacing, and overall cadence across sections. The goal is faithful spacing logic, not pixel OCR. Do not collapse into generic tight spacing if the design is more generous.

**Buttons / components:** inspect button size, shape, radius, fill vs outline, icon usage, hover-implied mood, primary vs secondary hierarchy, card structure, badge usage, dividers, shadows, borders, pill logic, and input styling. If detail is too small, generate a closer image. Map extracted controls onto Craft native components (section 12.D) plus Crosswind styling.

**Color:** inspect background color, panel colors, accent colors, button fills, text color hierarchy, border color logic, shadow color mood, image tint/grade, and gradient restraint. Preserve the original color logic as closely as reasonably possible. Do not replace a carefully designed palette with generic default web colors; encode it as CSS custom properties / Crosswind theme tokens.

---

## 19. DESIGN-TO-CODE COPY DISCIPLINE

After generating and analyzing the reference image(s), implement the website in a copy-oriented way: follow the references closely and preserve layout logic, spacing rhythm, section ordering, text/image balance, typography mood, component style, and overall visual cleanliness.

Do not drift into a different design direction during implementation. Do not "improve" the design by replacing it with a generic coded layout.

The goal is not "inspired by the image". The goal is "visually faithful to the image, translated into real Stacks frontend".

---

## 20. ANTI-DRIFT IMPLEMENTATION RULE

A common failure mode is design drift: the generated images look strong, but the coded result becomes generic. Strictly avoid that.

During implementation: do not simplify into default templates, do not replace distinctive sections with generic rows, do not compress generous spacing into dense layout, do not replace strong typography with plain hierarchy, do not remove the page's visual identity for convenience, do not merge section logic into repetitive patterns not present in the source images, and do not reintroduce nested-box complexity that was intentionally removed during analysis.

The final coded result should still feel like the same website as the generated references.

---

## 21. MISSING DETAIL RESOLUTION

When implementing from images, some details may still be unclear. Resolve ambiguity in this order:
1. preserve the visible design language
2. preserve layout and spacing logic
3. preserve component family
4. preserve mood and polish level
5. generate an extra detail image if needed
6. regenerate the section as a fresh standalone image if needed
7. only then choose the most implementation-friendly faithful version

Do not fill ambiguity with generic defaults too quickly.

---

## 22. ANTI-AI-SLOP RULES

Strictly avoid these patterns unless explicitly requested. For the full anti-slop doctrine, defer to **stacks-design-taste**; the essentials:

### Layout slop
one giant unreadable collage, endless centered sections, identical card rows repeated section after section, cloned left-text/right-image blocks, fake complexity without hierarchy, decorative empty space with no purpose, cards-inside-cards-inside-cards, giant rounded wrapper sections around everything, overcompartmentalized dashboard framing.

### Visual slop
default purple/blue AI gradients, too many glowing edges, floating blobs everywhere, glassmorphism stacked without reason, random futuristic details with no structure, over-rendered noise that hides the layout.

### Typography slop
giant heading + weak tiny subcopy, too many font moods, awkward line breaks, lazy all-caps everywhere, generic gradient headline tricks.

### Content slop
Avoid generic filler vibes: unleash, elevate, revolutionize, next-gen, seamless, transformative platform. Avoid fake brand slop: Acme, Nexus, Flowbit, Quantumly, NovaCore. Avoid fake complexity slop: pseudo-enterprise control labels, decorative system markers, filler status microcopy, fake operator/runtime/orchestration jargon unless truly central to the brand.

### Density slop
over-packed sections, card overload, tiny spacing between major sections, visually exhausting walls of content.

---

## 23. SECTION RHYTHM AND SPACING DISCIPLINE

A high-end site does not feel like the same block repeated forever. Vary section rhythm across the page by changing density, image-to-text ratio, alignment, scale, whitespace, card grouping, background intensity, and visual tempo. But keep the page coherent, keep spacing controlled, avoid random jumps, and keep each section clean enough to analyze well.

Do not make the website too dense. The page should breathe. Use even section spacing, keep major section gaps controlled and intentional, allow negative space to create calmness, avoid one section feeling cramped while the next feels empty, prefer analyzable generous spacing over compressed compositions, and let simplicity do part of the design work.

A premium website should feel open, composed, balanced, confident, and breathable. Not cramped, noisy, uneven, overfilled, or visually exhausting.

---

## 24. DEFAULT SECTION PACKS

### 4-section pack
1. Hero
2. Features
3. Social proof / testimonial
4. CTA

### 8-section pack
1. Hero
2. Trust bar
3. Features
4. Product showcase
5. Benefits / use cases
6. Testimonials
7. Pricing
8. CTA

### 12-section pack
1. Hero
2. Trust bar
3. Feature grid
4. Product preview
5. Problem / solution
6. Benefits
7. Workflow
8. Metrics / proof / integration
9. Testimonials
10. Pricing
11. FAQ
12. CTA + footer

These should usually become section-by-section images, not one compressed sheet.

---

## 25. MULTI-IMAGE CONSISTENCY RULE

For multi-image websites, enforce the same brand world, type scale logic, spacing discipline, CTA styling, icon mood, image treatment, tonal language, and component family. Image 2, 3, or 8 must not drift into a different website.

---

## 26. FINAL PRE-FLIGHT CHECK

Before finalizing, verify internally. These are binding gates, not suggestions.

1. Has the design been generated first?
2. Have all generated images been deeply analyzed?
3. Is the text readable enough? If not, were extra detail images created?
4. Were enough images generated, or was the image count too lazy?
5. Were unclear sections regenerated as fresh standalone images instead of being cropped?
6. Is the hierarchy obvious?
7. Is the hero clean enough, with a headline of 1-3 lines?
8. Is typography analyzed properly, not flattened to a generic hierarchy?
9. Are spacing relationships understood and preserved (not collapsed to generic tight spacing)?
10. Are buttons and components extracted and mapped onto Craft/Crosswind, not guessed?
11. Are colors analyzed and encoded as tokens, not replaced with default web colors?
12. Is the design visually distinctive and free of obvious AI tells?
13. Can someone code from the references faithfully, and does the coded result still feel like the same website?
14. If multiple images exist, do they clearly belong together?
15. Was section compression avoided (no many-sections-in-one tiny image)?
16. Has unnecessary nested boxing been removed?
17. Is the first screen clean and readable on a small laptop?
18. Have useless pills, labels, and fake technical micro-elements been reduced?
19. Is the implementation pure stx + Crosswind + composables + CSS, with NO JSX, `motion`, `gsap`, `next/*`, `lucide`/`phosphor` npm, hand-rolled SVG icons, `var`, `document.*`, or `window.*`?
20. Are icons Iconify `i-*` classes (hugeicons default), one collection per project?
21. Is motion CSS + allowed composables only, with reduced-motion gated when MOTION_INTENSITY > 3, and no `window` scroll listeners or rAF-into-state loops?
22. Is dark mode `dark:` + `useColorMode()`/`useDark()`, images `<img>` + asset pipeline, fonts config + `<link>`/`@font-face` with `display: swap`?
23. Are only composables from section 12.I's allowed list used (else plain CSS / standard DOM API / defer to stacks-composables)?

If any gate fails, refine internally before output.

---

## 27. RESPONSE BEHAVIOR

When the user asks for a website design in an image-to-code workflow:
1. infer site type and number of sections
2. if image generation is available and visual quality is central, generate the design image(s) first
3. prefer one large image per section
4. generate additional detail/extraction images if text or components are too small
5. generate more images whenever that improves readability or extraction quality; do not be lazy with image count
6. do not crop old images for section extraction; regenerate sections as fresh standalone images when needed
7. choose a strong visual direction and commit to it (defer to stacks-design-taste for the direction vocabulary)
8. enforce hero cleanliness and short hero line count
9. reduce unnecessary pills, labels, and micro-UI clutter
10. avoid cards-inside-cards-inside-cards and giant boxed section wrappers
11. keep the first screen readable and balanced on a small laptop
12. enforce strong, systematic image usage where appropriate
13. keep spacing generous, even, and analyzable
14. deeply and cleanly analyze all generated images
15. extract text, typography, spacing, buttons, colors, components, and layout logic
16. implement the website in stx + Crosswind + composables + CSS to match the references as closely as reasonably possible
17. create the final `.stx` files only after the full analysis pass

Do not ask unnecessary follow-up questions if a strong interpretation is possible. Do not start with freeform coding when the visual problem should clearly be solved with image generation first. Do not compress many sections into one unreadable image. Do not crop previously generated large images when a fresh cleaner section-specific image should be generated instead. Do not leave any React/JSX/`motion`/`gsap`/`next` in the implementation.

---

## 28. FINAL GOAL

Generate website reference images that feel premium, art-directed, clear, structured, readable, analyzable, memorable, anti-generic, and implementation-friendly.

For visual website work, first generate the image(s), then deeply and cleanly analyze them, then use them as the primary visual source, then build the frontend in stx + Crosswind + composables to match them closely.

If the user wants multiple sections, prefer separate large section images instead of one compressed multi-section board. If a section needs more clarity, generate an additional extraction-oriented image. If more images would improve quality, generate more; do not be lazy with image count. Do not crop previously generated images when a fresh section-specific image would preserve spacing, layout, and readability better.

Avoid cards-inside-cards-inside-cards. Avoid giant boxed wrappers around every section. Avoid fake technical pills and decorative micro-labels. Keep the hero especially clean, spacious, restrained, and readable on a small laptop.

The result should be strong as section images, strong as a design system, strong under deep analysis, and strong as implemented Stacks frontend: a top-tier website concept translated faithfully into real stx + Crosswind code, not a tiny unreadable design board and not a generic coded reinterpretation.
