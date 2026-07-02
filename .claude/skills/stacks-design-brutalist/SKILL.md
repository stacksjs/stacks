---
name: stacks-design-brutalist
description: Use when a Stacks UI should feel industrial and brutalist - designing a data-heavy dashboard, portfolio, or editorial site that needs Swiss typography, sharp high contrast, rigid modular grids, monospace telemetry, and experimental analog-degradation effects. Composes with stacks-design-taste as an aesthetic preset built on stx + Crosswind + composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Industrial / Brutalist UI (Stacks)

**Related skills:** refines [`stacks-design-taste`](../stacks-design-taste/SKILL.md) (the flagship anti-slop skill) with an industrial/brutalist preset. Build with [`stacks-stx`](../stacks-stx/SKILL.md) (semantic templating, signals), [`stacks-crosswind`](../stacks-crosswind/SKILL.md) (utilities, custom rules, `gap-px` grids), and [`stacks-ui`](../stacks-ui/SKILL.md) (Craft + headless components). Full composable reference: [`stacks-composables`](../stacks-composables/SKILL.md).

## 1. Skill Meta
Industrial brutalism and tactical telemetry interface engineering for Stacks apps. Advanced proficiency in architecting stx + Crosswind interfaces that synthesize mid-century Swiss typographic design, industrial manufacturing manuals, and retro-futuristic aerospace/military terminal interfaces. This discipline requires absolute mastery over rigid modular grids, extreme typographic scale contrast, purely utilitarian color palettes, and the programmatic simulation of analog degradation (halftones, CRT scanlines, bitmap dithering). The objective is digital environments that project raw functionality, mechanical precision, and high data density, deliberately discarding conventional consumer UI patterns.

## 2. Visual Archetypes
The system merges two distinct but highly compatible visual paradigms. **Pick ONE per project and commit to it. Do not alternate or mix both modes within the same interface.**

### 2.1 Swiss Industrial Print
Derived from 1960s corporate identity systems and heavy machinery blueprints.
- **Characteristics:** High-contrast light modes (newsprint/off-white substrates). Reliance on monolithic, heavy sans-serif typography. Unforgiving structural grids outlined by visible dividing lines. Aggressive, asymmetric use of negative space punctuated by oversized, viewport-bleeding numerals or letterforms. Heavy use of primary red as an alert/accent color.

### 2.2 Tactical Telemetry & CRT Terminal
Derived from classified military databases, legacy mainframes, and aerospace Heads-Up Displays (HUDs).
- **Characteristics:** Dark mode exclusivity. High-density tabular data presentation. Absolute dominance of monospaced typography. Integration of technical framing devices (ASCII brackets, crosshairs). Application of simulated hardware limitations (phosphor glow, scanlines, low bit-depth rendering).

## 3. Typographic Architecture
Typography is the primary structural and decorative infrastructure. Imagery is secondary. The system demands extreme variance in scale, weight, and spacing. Register font *choices* in the `fonts` config; load with `@font-face` / `<link>` + `font-display: swap` (never `next/font`).

### 3.1 Macro-Typography (Structural Headers)
- **Classification:** Neo-Grotesque / Heavy Sans-Serif.
- **Optimal Web Fonts:** Neue Haas Grotesk (Black), Archivo Black, Roboto Flex (Heavy), Monument Extended.
- **Implementation Parameters:**
  - **Scale:** Deployed at massive scales using fluid typography (`clamp(4rem, 10vw, 15rem)`).
  - **Tracking:** Extremely tight, often negative (`-0.03em` to `-0.06em`), forcing glyphs to form solid architectural blocks.
  - **Leading:** Highly compressed (`0.85` to `0.95`).
  - **Casing:** Exclusively uppercase for structural impact.

### 3.2 Micro-Typography (Data & Telemetry)
- **Classification:** Monospace / Technical Sans.
- **Optimal Web Fonts:** JetBrains Mono, IBM Plex Mono, Space Mono, VT323, Courier Prime.
- **Implementation Parameters:**
  - **Scale:** Fixed and small (`10px` to `14px` / `0.7rem` to `0.875rem`).
  - **Tracking:** Generous (`0.05em` to `0.1em`) to simulate mechanical typewriter spacing or terminal matrices.
  - **Leading:** Standard to tight (`1.2` to `1.4`).
  - **Casing:** Exclusively uppercase. Used for all metadata, navigation, unit IDs, and coordinates.

### 3.3 Textural Contrast (Artistic Disruption)
- **Classification:** High-Contrast Serif.
- **Optimal Web Fonts:** Playfair Display, EB Garamond, Times New Roman.
- **Implementation Parameters:** Used exceedingly sparingly. Must be subjected to heavy post-processing (halftone filters, 1-bit dithering) to degrade vector perfection and create textural juxtaposition against the clean sans-serifs.

## 4. Color System
The color architecture is uncompromising. Gradients, soft drop shadows, and modern translucency are strictly prohibited. Colors simulate physical media or primitive emissive displays.

**CRITICAL: Choose ONE substrate palette per project and use it consistently. Never mix light and dark substrates within the same interface.** Expose these as Crosswind theme tokens in `config/ui.ts`.

### If Swiss Industrial Print (Light):
- **Background:** `#F4F4F0` or `#EAE8E3` (matte, unbleached documentation paper).
- **Foreground:** `#050505` to `#111111` (carbon ink).
- **Accent:** `#E61919` or `#FF2A2A` (aviation/hazard red). This is the ONLY accent color. Used for strike-throughs, thick structural dividing lines, or vital data highlights.

### If Tactical Telemetry (Dark):
- **Background:** `#0A0A0A` or `#121212` (deactivated CRT; avoid pure `#000000`).
- **Foreground:** `#EAEAEA` (white phosphor). Primary text color.
- **Accent:** `#E61919` or `#FF2A2A` (aviation/hazard red). Same red, same rules.
- **Terminal Green (`#4AF626`):** Optional. Use ONLY for a single specific UI element (one status indicator or one data readout), never as a general text color. If it does not serve a clear purpose, omit it entirely.

## 5. Layout and Spatial Engineering
The layout must appear mathematically engineered. It rejects conventional web padding in favor of visible compartmentalization.
- **The Blueprint Grid:** Strict adherence to CSS Grid architectures (`grid` utilities). Elements do not float; they anchor precisely to grid tracks and intersections.
- **Visible Compartmentalization:** Extensive solid borders (`border` / `border-2 border-solid`) to delineate distinct zones. Horizontal rules (`<hr>`) frequently span the entire container width to segregate operational units.
- **Bimodal Density:** Layouts oscillate between extreme data density (tightly packed monospace metadata) and vast expanses of calculated negative space framing macro-typography.
- **Geometry:** Absolute rejection of `border-radius`. All corners must be exactly 90 degrees to enforce mechanical rigidity. Ban `rounded-*` utilities entirely.

## 6. UI Components and Symbology
Standard web UI conventions are replaced with utilitarian, industrial graphic elements.
- **Syntax Decoration:** ASCII characters to frame data points.
  - *Framing:* `[ DELIVERY SYSTEMS ]`, `< RE-IND >`
  - *Directional:* `>>>`, `///`, `\\\\`
- **Industrial Markers:** Prominent registration (`®`), copyright (`©`), and trademark (`™`) symbols functioning as structural geometric elements rather than legal text.
- **Technical Assets:** Crosshairs (`+`) at grid intersections, repeating vertical lines (barcodes), thick horizontal warning stripes, and randomized string data (`REV 2.6`, `UNIT / D-01`) to simulate active mechanical processes.
- **Icons:** When an icon is unavoidable, use Iconify `i-*` classes with a single sharp monoline collection; NEVER hand-roll SVG icon paths or `npm install` an icon library. Prefer ASCII/typographic symbology over decorative icons.

```html
<!-- resources/components/TelemetryRow.stx -->
<div class="grid grid-cols-4 gap-px bg-[#E61919]">
  <dl class="bg-[#0A0A0A] p-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#EAEAEA]">
    <dt class="text-[#E61919]">[ UNIT ID ]</dt>
    <dd><output>D-01</output></dd>
  </dl>
  <dl class="bg-[#0A0A0A] p-3 font-mono text-[11px] uppercase tracking-[0.08em] text-[#EAEAEA]">
    <dt class="text-[#E61919]">[ REV ]</dt>
    <dd><samp>2.6</samp></dd>
  </dl>
</div>
```

## 7. Textural and Post-Processing Effects
To prevent a purely digital look, simulated analog degradation is engineered into the frontend via CSS and SVG filters (in the `.stx` `<style>` block, no external libraries).
- **Halftone and 1-Bit Dithering:** Transform continuous-tone images or large serif typography into dot-matrix patterns via pre-processing or CSS `mix-blend-mode: multiply` overlays combined with SVG radial dot patterns.
- **CRT Scanlines:** For terminal interfaces, apply a `repeating-linear-gradient` to simulate horizontal electron beam sweeps (`repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`).
- **Mechanical Noise:** A global, low-opacity SVG static/noise filter applied to the DOM root to introduce a unified physical grain across both dark and light modes. Attach to a `position: fixed; pointer-events: none` layer, never a scrolling container.

## 8. Web Engineering Directives
1. **Grid Determinism:** Use `display: grid; gap: 1px;` (`grid gap-px`) with contrasting parent/child background colors to generate mathematically perfect, razor-thin dividing lines without complex border declarations.
2. **Semantic Rigidity:** Construct the DOM with precise semantic tags (`<data>`, `<samp>`, `<kbd>`, `<output>`, `<dl>`) to accurately reflect the technical nature of the telemetry. This aligns with stx's div-soup ban; use real semantic elements.
3. **Typography Clamping:** Use CSS `clamp()` exclusively for macro-typography so massive text scales aggressively while maintaining structural integrity across viewports.
4. **Motion (if any):** Stacks ships no animation library; do NOT import `motion`, `gsap`, or `framer-motion`. Keep motion mechanical and minimal via Crosswind transitions and CSS keyframes. For any scroll-triggered reveal use `useIntersectionObserver(target, cb)`; NEVER `window.addEventListener('scroll', ...)`. Animate only `transform` and `opacity`. No `var`/`document.*`/`window.*` in stx scripts. Gate motion with `@media (prefers-reduced-motion: reduce)` and/or `useMediaQuery('(prefers-reduced-motion: reduce)')`.
5. **Output:** Ship complete stx files, never a skeleton or placeholder comment.
