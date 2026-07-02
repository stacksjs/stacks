---
name: stacks-design-minimalist
description: Use when a Stacks UI should feel editorial and minimalist (Notion/Linear vibe) - designing a docs site, dashboard, landing page, or content surface that needs restrained warm monochrome, typographic contrast, flat bento grids, muted pastel accents, and no gradients or heavy shadows. Composes with stacks-design-taste as an aesthetic preset built on stx + Crosswind + composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Editorial / Minimalist UI (Stacks)

**Related skills:** refines [`stacks-design-taste`](../stacks-design-taste/SKILL.md) (the flagship anti-slop skill) with a restrained editorial preset. Build with [`stacks-stx`](../stacks-stx/SKILL.md) (templating, signals), [`stacks-crosswind`](../stacks-crosswind/SKILL.md) (utilities, dark mode, custom rules), and [`stacks-ui`](../stacks-ui/SKILL.md) (Craft + headless components). Full composable reference: [`stacks-composables`](../stacks-composables/SKILL.md).

## 1. Protocol Overview
Premium utilitarian minimalism and editorial UI. A frontend engineering directive for generating highly refined, ultra-minimalist, "document-style" web interfaces analogous to top-tier workspace platforms, built with stx + Crosswind. This protocol strictly enforces a high-contrast warm monochrome palette, bespoke typographic hierarchies, meticulous structural macro-whitespace, bento-grid layouts, and an ultra-flat component architecture with deliberate muted pastel accents. It actively rejects standard generic SaaS design trends.

## 2. Absolute Negative Constraints (Banned Elements)
Strictly avoid these generic web development defaults:
- DO NOT use the "Inter", "Roboto", or "Open Sans" typefaces. (These are font *choices*; load your chosen fonts via the `fonts` config plus `@font-face` / `<link>` with `font-display: swap`, never `next/font`.)
- DO NOT use generic thin-line icon libraries like "Lucide", "Feather", or standard "Heroicons". Use Iconify `i-*` classes instead, and NEVER hand-roll SVG icon paths or `npm install` an icon package.
- DO NOT use Crosswind's default heavy drop shadows (for example `shadow-md`, `shadow-lg`, `shadow-xl`). Shadows must be practically non-existent or heavily customized to be ultra-diffuse and low opacity (< 0.05).
- DO NOT use primary colored backgrounds for large elements or sections (no bright blue, green, or red hero sections).
- DO NOT use gradients, neon colors, or 3D glassmorphism (beyond subtle navbar blurs).
- DO NOT use `rounded-full` (pill shapes) for large containers, cards, or primary buttons.
- DO NOT use emojis anywhere in code, markup, text content, headings, or alt text. Replace with proper Iconify icons or clean SVG primitives.
- DO NOT use generic placeholder names like "John Doe", "Acme Corp", or "Lorem Ipsum". Use realistic, contextual content.
- DO NOT use AI copywriting cliches: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve". Write plain, specific language.

## 3. Typographic Architecture
The interface must rely on extreme typographic contrast and premium font selection for an editorial feel. Register these in the `fonts` config; load with `@font-face` + `font-display: swap`.
- Primary Sans-Serif (Body, UI, Buttons): clean, geometric, or system-native fonts with character. Target: `font-family: 'SF Pro Display', 'Geist Sans', 'Helvetica Neue', 'Switzer', sans-serif`.
- Editorial Serif (Hero Headings & Quotes): Target: `font-family: 'Lyon Text', 'Newsreader', 'Playfair Display', 'Instrument Serif', serif`. Apply tight tracking (`letter-spacing: -0.02em` to `-0.04em`) and tight line-height (`1.1`).
- Monospace (Code, Keystrokes, Meta-data): Target: `font-family: 'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace`.
- Text Colors: Body text must never be absolute black (`#000000`). Use off-black/charcoal (`#111111` or `#2F3437`) with a generous `line-height` of `1.6` for legibility. Secondary text should be muted gray (`#787774`).

## 4. Color Palette (Warm Monochrome + Spot Pastels)
Color is a scarce resource, used only for semantic meaning or subtle accents.
- Canvas / Background: Pure White `#FFFFFF` or Warm Bone/Off-White `#F7F6F3` / `#FBFBFA`.
- Primary Surface (Cards): `#FFFFFF` or `#F9F9F8`.
- Structural Borders / Dividers: Ultra-light gray `#EAEAEA` or `rgba(0,0,0,0.06)`.
- Accent Colors: Exclusively use highly desaturated, washed-out pastels for tags, inline code backgrounds, or subtle icon backgrounds.
  - Pale Red: `#FDEBEC` (Text: `#9F2F2D`)
  - Pale Blue: `#E1F3FE` (Text: `#1F6C9F`)
  - Pale Green: `#EDF3EC` (Text: `#346538`)
  - Pale Yellow: `#FBF3DB` (Text: `#956400`)

Expose these as Crosswind theme tokens or CSS custom properties in `config/ui.ts` so dark mode (`dark:` + `useColorMode()` / `useDark()`) stays consistent.

## 5. Component Specifications
- Bento Box Feature Grids:
  - Use asymmetrical CSS Grid layouts (`grid grid-cols-1 md:grid-cols-6` with mixed `col-span`).
  - Cards must have exactly `border: 1px solid #EAEAEA` (`border border-[#EAEAEA]`).
  - Border-radius must be crisp: `8px` or `12px` maximum (`rounded-lg` / `rounded-xl`).
  - Internal padding must be generous (`p-6` to `p-10`).
- Primary Call-To-Action (Buttons):
  - Solid background `#111111`, text `#FFFFFF`.
  - Slight border-radius (`rounded` to `rounded-md`). No box-shadow.
  - Hover state is a subtle color shift to `#333333` or a micro `active:scale-[0.98]`.
- Tags & Status Badges:
  - Pill-shaped (`rounded-full`), very small typography (`text-xs`), uppercase with wide tracking (`tracking-[0.05em]`).
  - Background uses the defined muted pastels. (Pills are allowed on small badges, never on large containers.)
- Accordions (FAQ):
  - Strip all container boxes. Separate items only with `border-b border-[#EAEAEA]`.
  - Use a clean, sharp `+` and `-` toggle. Reach for the headless `Disclosure` component in [`stacks-ui`](../stacks-ui/SKILL.md) and toggle state with a signal.
- Keystroke Micro-UIs:
  - Render shortcuts as physical keys using `<kbd>`: `border border-[#EAEAEA] rounded bg-[#F7F6F3]` in the monospace font.
- Faux-OS Window Chrome:
  - When mocking software, wrap it in a minimalist container with a white top bar containing three small, light gray circles (macOS window controls).

```html
<!-- resources/components/BentoCard.stx -->
<article class="border border-[#EAEAEA] rounded-xl bg-white dark:bg-neutral-900 p-8">
  <span class="inline-block rounded-full bg-[#E1F3FE] text-[#1F6C9F]
               text-xs uppercase tracking-[0.05em] px-2 py-0.5">Docs</span>
  <h3 class="mt-4 text-2xl text-[#111111] dark:text-neutral-100">Structured writing</h3>
  <p class="mt-2 text-[#787774] leading-[1.6]"><slot /></p>
</article>
```

## 6. Iconography & Imagery Directives
- System Icons: Use Iconify `i-*` classes with a technical, slightly thicker-stroke aesthetic (for example `i-ph-*` bold/fill weights, or `i-radix-icons-*`). Standardize stroke width across all icons; keep one collection per project. NEVER hand-roll SVG icon paths.
- Illustrations: Monochromatic, rough continuous-line ink sketches on white, featuring a single offset geometric shape filled with a muted pastel color.
- Photography: High-quality, desaturated, warm-toned images. Apply subtle overlays (`opacity: 0.04` warm grain) to blend photos into the monochrome palette. Never use oversaturated stock photos. Use `<img>` with explicit `width`/`height` (reserve space to avoid CLS) and the stx asset pipeline; heavy assets go through `@stacksjs/storage`. Placeholder: `https://picsum.photos/seed/{context}/1200/800`.
- Hero & Section Backgrounds: Sections should not feel empty and flat. Use subtle full-width background imagery at very low opacity, soft radial light spots (`radial-gradient` with warm tones at `opacity: 0.03`), or minimal geometric line patterns to add depth without breaking the clean aesthetic.

## 7. Subtle Motion & Micro-Animations
Motion should feel invisible: present but never distracting. Quiet sophistication, not spectacle. Stacks ships no animation library; build motion with Crosswind transitions, CSS keyframes in the `.stx` `<style>` block, and the allowed composables. Do NOT import `motion`, `gsap`, or `framer-motion`.
- Scroll Entry: Elements fade in gently as they enter the viewport. Use `translateY(12px)` + `opacity: 0` resolving over `600ms` with `cubic-bezier(0.16, 1, 0.3, 1)`. Toggle the class with `useIntersectionObserver(target, cb)` or `useElementVisibility(target)`; NEVER `window.addEventListener('scroll', ...)`.
- Hover States: Cards lift with an ultra-subtle shadow shift (`box-shadow` from `0 0 0` to `0 2px 8px rgba(0,0,0,0.04)` over `200ms`). Buttons respond with `active:scale-[0.98]`.
- Staggered Reveals: List and grid items enter with a cascade delay (`animation-delay: calc(var(--index) * 80ms)`). Never mount everything at once.
- Background Ambient Motion: Optional. A single very slow radial gradient blob (`animation-duration: 20s+`, `opacity: 0.02-0.04`) drifting behind hero sections, applied to a `position: fixed; pointer-events: none` layer. Never on scrolling containers.
- Performance: Animate exclusively via `transform` and `opacity`. No layout-triggering properties (`top`, `left`, `width`, `height`). Use `will-change: transform` sparingly and only on actively animating elements.
- Reduced motion: gate with CSS `@media (prefers-reduced-motion: reduce)` and/or `useMediaQuery('(prefers-reduced-motion: reduce)')`.

```html
<script client>
  const block = useRef('block')
  const shown = state(false)
  useIntersectionObserver(block, (e) => { if (e[0].isIntersecting) shown.set(true) }, { threshold: 0.2 })
</script>

<section ref="block"
         :class="shown() ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'"
         class="transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
  <slot />
</section>
```

## 8. Execution Protocol
When writing stx / Crosswind or designing a layout:
1. Establish macro-whitespace first. Use massive vertical padding between sections (`py-24` or `py-32`).
2. Constrain main typography content width to `max-w-4xl` or `max-w-5xl`.
3. Apply the custom typographic hierarchy and monochromatic color tokens immediately.
4. Ensure every card, divider, and border adheres strictly to the `1px solid #EAEAEA` rule.
5. Add scroll-entry animations to all major content blocks via `useIntersectionObserver`.
6. Ensure sections have visual depth through imagery, ambient gradients, or subtle textures; no empty flat backgrounds.
7. Deliver complete stx that reflects this high-end, uncluttered, editorial aesthetic natively without requiring manual adjustments. Ship the full file, never a skeleton or placeholder comment.
