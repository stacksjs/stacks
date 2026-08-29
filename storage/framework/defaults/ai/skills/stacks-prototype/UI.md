# UI prototype

Generate **several radically different variants** of one view and let the user
flip between them in the browser, pick one (or steal bits from each), and throw
the rest away.

If the question is about logic or state rather than what something looks like,
this is the wrong branch. Use [LOGIC.md](LOGIC.md).

## When this is the right shape

- "What should this page look like?"
- "I want to see a few options for this dashboard before committing."
- "Try a different layout for the settings screen."
- Any time the user would otherwise spend a day picking between three vague
  mockups in their head.

## Judge it against the real app

A variant is much easier to judge when it is **butting up against the rest of the
app**: real layout, real data, real density. A throwaway page on its own is a
vacuum where every variant looks fine. So prefer, in order:

1. **Variants inside the existing view.** The route already exists and its data
   already loads. Only the rendered subtree swaps. Pick this whenever there is a
   plausible host page, including for something new that would naturally live
   inside one (a new section of a dashboard, a new card on a settings screen).
2. **Throwaway views**, only when the thing genuinely has no existing page to
   live inside.

## Process

### 1. State the question and pick N

Default to **3** variants. Past 5 they stop being radically different and start
being noise, so cap there. Write the plan in one line at the top of the host
view:

> Three variants of the settings page, switchable from the prototype bar, on the
> existing settings view.

### 2. Generate radically different variants

Draft each variant as an stx component under
`resources/components/prototype/<name>/VariantA.stx` (and B, C). Hold each one
to:

- The page's purpose and the data it actually has.
- Crosswind utilities, Iconify classes for icons, and signals or composables in
  `<script>` blocks. The project's frontend rules do not relax for a prototype:
  no `var`, no `document.*`, no `window.*`, no animation library, no em-dash in
  any visible copy.
- A clear component name and a one-line description of the idea behind it.

Variants must be **structurally different**: different layout, different
information hierarchy, different primary affordance. Not different colours. Three
slightly tweaked card grids is wallpaper, not a prototype. If two drafts come out
too similar, redo one under an explicit constraint ("no card grid").

### 3. Wire them together

Two mechanics, and both are fine. Pick by how the host view already gets its
state:

- **One view per variant.** Add `resources/views/prototype/<name>/a.stx`,
  `b.stx`, `c.stx`, each rendering one variant inside the real layout. Views are
  file-routed, so these are reachable immediately, though a newly nested
  directory usually needs a `buddy dev` restart before it stops 404ing.
- **One view, switched on a signal**, when the host view already reads request
  state. Render `@if` on the variant and default to A.

Either way the variants sit inside the real layout and the real data, which is
the point.

### 4. Build the floating switcher

One shared stx partial under `resources/partials/`, included by each prototype
view:

- Links or buttons to the previous and next variant, wrapping around.
- The current variant key and its name, for instance `B (sidebar layout)`.
- Fixed to the bottom centre, high contrast, visually distinct from the page so
  it is obviously not part of the design being judged.
- Rendered only outside production. Gate it on the app environment so a stray
  merge cannot ship the bar to users.

### 5. Hand it over

Give the user the URLs. The interesting feedback is almost always "I want the
header from B with the sidebar from C", which is the design they actually want.

### 6. Capture the answer and clean up

Once a variant wins, capture the answer (which one and why), then capture the
prototype the way [SKILL.md](SKILL.md) describes:

- Fold the winner into the real view, rewritten to production standard against
  `stacks-design-taste`.
- Move the losing variants, the prototype views and the switcher partial onto the
  `prototype/<name>` branch. They rot fast in `main` and confuse the next reader.
- Run `./buddy lint:fix` and remove the prototype directory from `main`.

## Anti-patterns

- **Variants that differ only in colour or copy.** That is a tweak. Real variants
  disagree about structure.
- **Sharing too much between variants.** A shared layout defeats the point. Each
  variant should be free to throw the layout out.
- **Wiring variants to real mutations.** Read-only is fine. The question is what
  it should look like, not whether the backend works.
- **Promoting the prototype straight to production.** Rewrite it when you fold it
  in.
