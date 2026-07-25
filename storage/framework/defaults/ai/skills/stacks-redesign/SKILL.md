---
name: stacks-redesign
description: Use when auditing and upgrading an existing Stacks UI to premium quality - finding AI-slop and generic patterns in stx templates, then fixing layout, spacing, hierarchy, type, color, states, and copy without breaking functionality or migrating the stack. Composes with stacks-design-taste as the audit-first companion, working in stx + Crosswind + composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Redesign an Existing Stacks UI

**Related skills:** the audit-first companion to [`stacks-design-taste`](../stacks-design-taste/SKILL.md) (the flagship anti-slop skill). Apply an aesthetic preset with [`stacks-design-soft`](../stacks-design-soft/SKILL.md), [`stacks-design-minimalist`](../stacks-design-minimalist/SKILL.md), or [`stacks-design-brutalist`](../stacks-design-brutalist/SKILL.md). Work in [`stacks-stx`](../stacks-stx/SKILL.md), [`stacks-crosswind`](../stacks-crosswind/SKILL.md), [`stacks-ui`](../stacks-ui/SKILL.md), and [`stacks-composables`](../stacks-composables/SKILL.md).

## How This Works

When applied to an existing Stacks project, follow this sequence:

1. **Scan** - Read the codebase. Confirm the stack is stx + Crosswind + composables. Locate `resources/views/*.stx`, `resources/components/*.stx`, `resources/layouts/*.stx`, `config/ui.ts`, `config/crosswind.ts`, and the `fonts` config. Note current design patterns.
2. **Diagnose** - Run through the audit below. List every generic pattern, weak point, and missing state you find.
3. **Fix** - Apply targeted upgrades working with the existing stx + Crosswind stack. Do not rewrite from scratch and do not migrate frameworks. Improve what is there.

## Design Audit

### Typography

Check for these problems and fix them:
- **Browser default fonts or Inter everywhere.** Replace with a font that has character (`Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi`). Register the choice in the `fonts` config and load it with `@font-face` / `<link>` + `font-display: swap` in the layout `.stx` head. For editorial/creative projects, pair a serif header with a sans-serif body.
- **Headlines lack presence.** Increase size for display text, tighten letter-spacing, reduce line-height. Headlines should feel heavy and intentional.
- **Body text too wide.** Limit paragraph width to roughly 65 characters (`max-w-prose` / `max-w-2xl`). Increase line-height for readability.
- **Only Regular (400) and Bold (700) weights used.** Introduce Medium (500) and SemiBold (600) for subtler hierarchy.
- **Numbers in proportional font.** Use a monospace font or enable tabular figures (`tabular-nums` / `font-variant-numeric: tabular-nums`) for data-heavy interfaces.
- **Missing letter-spacing adjustments.** Negative tracking for large headers, positive tracking for small caps or labels.
- **All-caps subheaders everywhere.** Try lowercase italics, sentence case, or small-caps instead.
- **Orphaned words.** Single words alone on the last line. Fix with `text-wrap: balance` or `text-wrap: pretty`.

### Color and Surfaces

- **Pure `#000000` background.** Replace with off-black, dark charcoal, or tinted dark (`#0a0a0a`, `#121212`, or a dark navy).
- **Oversaturated accent colors.** Keep saturation below 80%. Desaturate accents so they blend with neutrals instead of screaming.
- **More than one accent color.** Pick one. Remove the rest. Consistency beats variety.
- **Mixing warm and cool grays.** Stick to one gray family; tint all grays with a consistent hue.
- **Purple/blue "AI gradient" aesthetic.** The most common AI design fingerprint. Replace with neutral bases and a single, considered accent.
- **Generic `box-shadow`.** Tint shadows to match the background hue. Use colored shadows instead of pure black at low opacity.
- **Flat design with zero texture.** Add subtle noise, grain, or micro-patterns to backgrounds. Pure flat vectors feel sterile.
- **Perfectly even gradients.** Break uniformity with radial gradients, noise overlays, or mesh gradients instead of standard linear 45-degree fades.
- **Inconsistent lighting direction.** Audit all shadows to suggest a single, consistent light source.
- **Random dark sections in a light-mode page (or vice versa).** A single dark-background section breaking an otherwise light page looks like a copy-paste accident. Either commit to full dark mode (`dark:` + `useColorMode()` / `useDark()`) or keep a consistent tone throughout. If contrast is needed, use a slightly darker shade of the same palette, not a sudden jump to `#111` in the middle of a cream page.
- **Empty, flat sections with no visual depth.** Add high-quality background imagery (blurred, overlaid, or masked), subtle patterns, or ambient gradients. Use `<img>` with explicit `width`/`height` via the stx asset pipeline; placeholder source `https://picsum.photos/seed/{name}/1920/1080`. Even a subtle full-width photo at low opacity adds presence.

### Layout

- **Everything centered and symmetrical.** Break symmetry with offset margins, mixed aspect ratios, or left-aligned headers over centered content.
- **Three equal card columns as feature row.** The most generic AI layout. Replace with a 2-column zig-zag, asymmetric grid, horizontal scroll, or masonry layout.
- **Using `height: 100vh` for full-screen sections.** Replace with `min-h-[100dvh]` to prevent layout jumping on mobile browsers (iOS Safari viewport bug).
- **Complex flexbox percentage math.** Replace with CSS Grid (`grid` utilities) for reliable multi-column structures.
- **No max-width container.** Add a container constraint (around `max-w-7xl`, 1200-1440px) with `mx-auto` so content does not stretch edge-to-edge on wide screens.
- **Cards of equal height forced by flexbox.** Allow variable heights or use masonry when content varies.
- **Uniform border-radius on everything.** Vary the radius: tighter on inner elements, softer on containers.
- **No overlap or depth.** Use negative margins to create layering and visual depth.
- **Symmetrical vertical padding.** Adjust optically; bottom padding often needs to be slightly larger.
- **Dashboard always has a left sidebar.** Try top navigation, a floating command menu, or a collapsible panel instead.
- **Missing whitespace.** Double the spacing. Let the design breathe. Dense layouts work for data dashboards, not for marketing pages.
- **Buttons not bottom-aligned in card groups.** Pin CTAs to the bottom of each card so they form a clean horizontal line regardless of content above.
- **Feature lists starting at different vertical positions.** In pricing tables or comparison cards, feature lists should start at the same Y position across columns.
- **Inconsistent vertical rhythm in side-by-side elements.** Align shared elements (titles, descriptions, prices, buttons) across all items. Misaligned baselines make the layout look broken.
- **Mathematical alignment that looks optically wrong.** Icons next to text, play buttons in circles, or text in buttons often need 1-2px optical adjustments to feel right.

### Interactivity and States

- **No hover states on buttons.** Add background shift, slight scale, or translate on `hover:`.
- **No active/pressed feedback.** Add `active:scale-[0.98]` or `active:translate-y-px` to simulate a physical click.
- **Instant transitions with zero duration.** Add smooth transitions (200-300ms) to all interactive elements.
- **Missing focus ring.** Ensure visible `focus-visible:` indicators for keyboard navigation. An accessibility requirement, not optional.
- **No loading states.** Replace generic circular spinners with skeleton loaders that match the layout shape. Drive async state with `useAsync` / `useFetch` / `useQuery`.
- **No empty states.** Design a composed "getting started" view instead of a blank dashboard.
- **No error states.** Add clear, inline error messages for forms. Do NOT use `window.alert()` (and never bare `window.*` in stx scripts).
- **Dead links.** Buttons that link to `#`. Either link to real destinations or visually disable them.
- **No indication of current page in navigation.** Style the active nav link differently (use `useRoute()` / `useRouter()` to detect it).
- **Scroll jumping.** Anchor clicks jump instantly. Add `scroll-behavior: smooth`.
- **Animations using `top`, `left`, `width`, `height`.** Switch to `transform` and `opacity` for GPU-accelerated, smooth animation.

### Content

- **Generic names like "John Doe" or "Jane Smith".** Use diverse, realistic-sounding names.
- **Fake round numbers like `99.99%`, `50%`, `$100.00`.** Use organic, messy data: `47.2%`, `$99.00`, `+1 (312) 847-1928`.
- **Placeholder company names like "Acme Corp", "Nexus", "SmartFlow".** Invent contextual, believable brand names.
- **AI copywriting cliches.** Never use "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve", "Tapestry", or "In the world of...". Write plain, specific language.
- **Exclamation marks in success messages.** Remove them. Be confident, not loud.
- **"Oops!" error messages.** Be direct: "Connection failed. Please try again."
- **Passive voice.** Use active voice: "We couldn't save your changes" instead of "Mistakes were made."
- **All blog post dates identical.** Randomize dates to appear real.
- **Same avatar image for multiple users.** Use unique assets for every distinct person.
- **Lorem Ipsum.** Never use placeholder latin text. Write real draft copy.
- **Title Case On Every Header.** Use sentence case instead.

### Component Patterns

- **Generic card look (border + shadow + white background).** Remove the border, or use only background color, or use only spacing. Cards should exist only when elevation communicates hierarchy.
- **Always one filled button + one ghost button.** Add text links or tertiary styles to reduce visual noise.
- **Pill-shaped "New" and "Beta" badges.** Try square badges, flags, or plain text labels.
- **Accordion FAQ sections.** Use a side-by-side list, searchable help, or inline progressive disclosure. When you do keep a disclosure, use the headless `Disclosure` from [`stacks-ui`](../stacks-ui/SKILL.md).
- **3-card carousel testimonials with dots.** Replace with a masonry wall, embedded social posts, or a single rotating quote.
- **Pricing table with 3 towers.** Highlight the recommended tier with color and emphasis, not just extra height.
- **Modals for everything.** Use inline editing, slide-over panels, or expandable sections instead of popups for simple actions. For real modals reach for the headless `Dialog`/`Modal` in [`stacks-ui`](../stacks-ui/SKILL.md).
- **Avatar circles exclusively.** Try squircles or rounded squares for a less generic look.
- **Light/dark toggle always a sun/moon switch.** Use a dropdown, system preference detection (`useColorMode()` / `useDark()`), or integrate it into settings.
- **Footer link farm with 4 columns.** Simplify. Focus on main navigational paths and legally required links.

### Iconography

- **Lucide or Feather icons exclusively.** The "default" AI icon choice. Use Iconify `i-*` classes (Phosphor `i-ph-*`, Heroicons, or the hugeicons default) for differentiation. NEVER hand-roll SVG icon paths and NEVER `npm install` an icon library.
- **Rocketship for "Launch", shield for "Security".** Replace cliche metaphors with less obvious icons (bolt, fingerprint, spark, vault).
- **Inconsistent stroke widths across icons.** Standardize to one stroke weight and one Iconify collection per project.
- **Missing favicon.** Always include a branded favicon.
- **Stock "diverse team" photos.** Use real team photos, candid shots, or a consistent illustration style instead of uncanny stock imagery.

### Code Quality

- **Div soup.** Use semantic stx markup: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`.
- **Inline styles mixed with utility classes.** Move styling into Crosswind utilities or the `.stx` `<style>` block.
- **Hardcoded pixel widths.** Use relative units (`%`, `rem`, `em`, `max-w-*`) for flexible layouts.
- **Missing alt text on images.** Describe image content for screen readers. Never leave `alt=""` or `alt="image"` on meaningful images.
- **Arbitrary z-index values like `9999`.** Establish a clean z-index scale in the theme/tokens.
- **Commented-out dead code.** Remove all debug artifacts before shipping.
- **Import hallucinations.** Check that every import actually exists. Composables are auto-imported (no import line); do not invent composable names. Verify components exist in `resources/components`.
- **Missing meta tags.** Add proper `<title>`, `description`, `og:image`, and social sharing meta via the `@seo` / `@meta` directives or `useHead` / `useSeoMeta`.
- **Vanilla JS in stx scripts.** Replace any `var`, `document.*`, or `window.*` with signals + composables + directives.

### Strategic Omissions (What AI Typically Forgets)

- **No legal links.** Add privacy policy and terms of service links in the footer.
- **No "back" navigation.** Every page needs a way back.
- **No custom 404 page.** Design a helpful, branded "page not found" experience.
- **No form validation.** Add client-side validation for emails, required fields, and format checks.
- **No "skip to content" link.** Add a hidden skip-link for keyboard users.
- **No cookie consent.** If required by jurisdiction, add a compliant consent banner.

## Upgrade Techniques

Pull from these high-impact techniques to replace generic patterns. All motion is built with Crosswind transitions, CSS keyframes, and composables; Stacks ships no animation library, so do NOT import `motion`, `gsap`, or `framer-motion`.

### Typography Upgrades
- **Variable font animation.** Interpolate weight or width on scroll or hover for text that feels alive.
- **Outlined-to-fill transitions.** Text starts as a stroke outline and fills with color on scroll entry or interaction.
- **Text mask reveals.** Large typography acting as a window to video or animated imagery behind it.

### Layout Upgrades
- **Broken grid / asymmetry.** Elements that deliberately ignore column structure: overlapping, bleeding off-screen, or offset with calculated randomness.
- **Whitespace maximization.** Aggressive negative space to force focus on a single element.
- **Parallax card stacks.** Sections that stick and physically stack over each other during scroll. Build with `position: sticky` + `top: 0` and CSS scroll-driven animations (`animation-timeline: view()` / `scroll()`), not GSAP ScrollTrigger.
- **Split-screen scroll.** Two halves of the screen sliding in opposite directions via CSS scroll-driven animations.

### Motion Upgrades
- **Smooth scroll with inertia.** Use `scroll-behavior: smooth`; keep it CSS-driven, never a `requestAnimationFrame` loop writing signal state every frame.
- **Staggered entry.** Elements cascade in with slight delays, combining Y-axis translation with opacity fade. Toggle with `useIntersectionObserver` / `useElementVisibility`. Never mount everything at once.
- **Spring physics.** Replace linear easing with custom cubic-bezier motion (for example `ease-[cubic-bezier(0.32,0.72,0,1)]`) for a natural, weighty feel.
- **Scroll-driven reveals.** Content entering through expanding masks, wipes, or draw-on SVG paths tied to scroll progress via CSS scroll-driven animations. NEVER `window.addEventListener('scroll', ...)`.

### Surface Upgrades
- **True glassmorphism.** Go beyond `backdrop-blur`. Add a 1px inner border and a subtle inner shadow to simulate edge refraction. Apply blur only to fixed/sticky elements.
- **Spotlight borders.** Card borders that illuminate under the cursor. Track the pointer with `useMouse()` and drive a CSS custom property from an `effect`.
- **Grain and noise overlays.** A fixed, `pointer-events-none` overlay with subtle noise to break digital flatness.
- **Colored, tinted shadows.** Shadows that carry the hue of the background rather than generic black.

## Fix Priority

Apply changes in this order for maximum visual impact with minimum risk:
1. **Font swap** - biggest instant improvement, lowest risk
2. **Color palette cleanup** - remove clashing or oversaturated colors
3. **Hover and active states** - makes the interface feel alive
4. **Layout and spacing** - proper grid, max-width, consistent padding
5. **Replace generic components** - swap cliche patterns for modern alternatives
6. **Add loading, empty, and error states** - makes it feel finished
7. **Polish typography scale and spacing** - the premium final touch

## Rules

- Work with the existing stx + Crosswind + composables stack. Do not migrate frameworks or styling libraries.
- Do not break existing functionality. Test after every change.
- Before importing any new library, check `package.json` first. Composables are auto-imported; do not invent composable names (defer to [`stacks-composables`](../stacks-composables/SKILL.md) for the real list).
- Respect CLAUDE.md hard bans: no `var`, no `document.*`, no `window.*` in stx scripts; lint with pickier (`bunx --bun pickier .`), never eslint.
- Keep changes reviewable and focused. Small, targeted improvements over big rewrites.
- Ship complete stx; never a skeleton or placeholder comment.
