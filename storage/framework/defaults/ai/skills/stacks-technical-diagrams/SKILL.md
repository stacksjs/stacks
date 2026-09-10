---
name: stacks-technical-diagrams
description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle diagrams for Stacks applications as explorable standalone HTML with inline SVG, dark/light themes, four visual presets, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accepts plain-language requirements or pasted Mermaid; reads repository evidence when the diagram must reflect real code; compares two architecture snapshots as a Before/Delta/After review. Use for system or cloud architecture, security boundaries, network topology, technical workflows, CI/CD, runbooks, API call sequences, request lifecycles, data pipelines, lineage, PII boundaries, state machines, status transitions, or converting Mermaid into a purpose-built diagram.
license: MIT
metadata:
  source: tt-a1i/archify
  source_version: "2.17.0-dev.1"
  source_commit: 18911058008f17dc065af23a2cdc9bfeff6d3f7a
  based_on: Cocoon-AI/architecture-diagram-generator (MIT, v1.0)
---

# Technical Diagrams for Stacks

Turn a small typed JSON specification into one self-contained, interactive HTML diagram. Static
output is the default; motion is opt-in.

Every delivered artifact carries a theme toggle (persists in `localStorage`, respects
`prefers-color-scheme`), pan/zoom, node search, focus with authored upstream/downstream reach, route
probing, a semantic lens, an overview radar, presentation mode, guided stories, and an export menu
(clipboard PNG; PNG/JPEG/WebP raster at up to 4x; dual-theme SVG; WebM for motion; 1200x630 share
cards). Those are reader capabilities that already exist in the output, not authoring work.

## Attribution

This skill ports the renderer, validator, and viewer from
[Archify](https://github.com/tt-a1i/archify) 2.17.0-dev.1 by tt-a1i under the MIT license. Archify is
itself a fork and rewrite of Cocoon AI's `architecture-diagram-generator` 1.0. Preserve `LICENSE` and
`THIRD_PARTY_NOTICES.md` when redistributing this skill or substantial portions of its source.

## Running the CLI

Every command below is one launcher invocation from the Stacks project root:

```bash
.claude/skills/stacks-technical-diagrams/bin/diagrams doctor
```

The launcher runs Bun against the skill's own empty `bunfig.toml` with `--no-env-file`, so a diagram
render never inherits the application's `preload` chain or its `.env`. Never call the renderers with
a bare `bun`; use the launcher (or `bun --config=<skill>/bunfig.toml --no-env-file
<skill>/bin/technical-diagrams.mjs` if you need the explicit form).

Commands: `render`, `validate`, `deliver`, `compare`, `preview`, `visual-check`, `check`, `inspect`,
`migrate`, `guide`, `brands`, `examples`, `doctor`, `demo`. Run `diagrams` with no arguments for the
full usage block.

## Fast authoring path

Use this bounded path for ordinary generation.

1. Choose `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle` from the question. When
   ambiguous, run `diagrams guide "<scenario>" --json`.
2. Read one matching schema in `schemas/`, plus `schemas/common.schema.json`, plus one matching JSON
   example in `examples/`. Read only those files. Use the example for field shape, never for facts.
   New workflow sources use `schema_version: 2`; keep `schema_version: 1` only when preserving an
   existing workflow's fixed geometry.
3. Artifact first: the next tool action writes the candidate JSON. Do not plan exact coordinates in
   prose and do not read renderer internals before the first candidate. Start with one clear main
   path, short side branches, sparse labels, and at most 12 primary nodes. Set
   `meta.quality_profile: "showcase"` unless the user explicitly wants a dense `standard` map. Start
   with automatic routes and labels; do not add `via`, `channelX`, `channelY`, or `labelAt` before a
   diagnostic asks for one, and apply at most one diagnosed geometry control per repair.
4. Validate after every candidate edit and immediately before handoff:

   ```bash
   .claude/skills/stacks-technical-diagrams/bin/diagrams validate <type> <candidate.json> --quality showcase --json
   ```

   A receipt with only 4 artifact checks is basic validation, never showcase acceptance. A showcase
   pass reports all 9 artifact checks with 0 composition errors and 0 warnings. For a workflow v2
   geometry diagnosis, run `validate workflow <candidate.json> --layout-json` and read the stable
   compiler receipt; solver internals are not authoring controls. A passing final validation freezes
   the candidate: do not edit it afterward.
5. Deliver once, as the final acceptance step:

   ```bash
   .claude/skills/stacks-technical-diagrams/bin/diagrams deliver <type> <candidate.json> <output.html> --quality showcase --json
   ```

   A non-zero exit is never success. On failure, change only the diagnosed `subject`, verify
   `evidence`, choose from `supportedFixes`, and rerun. Keep correcting while the objective error
   count reaches a new minimum; if two consecutive rounds do not improve that best count, stop and
   report the unresolved diagnostics truthfully.

Inspect renderer or validator source only after an unsupported internal diagnostic or two failed
focused repairs.

## Stacks repository workflow

1. Inspect the implementation before drawing. Treat `app/` as overrides and
   `storage/framework/defaults/app/` as fallbacks. Follow registrations in `app/Routes.ts`, route
   files, actions, jobs, listeners, middleware, models, config, resources, and the framework entry
   points that matter to the requested view.
2. Read the relevant Stacks domain skill before mapping an unfamiliar subsystem. Common companions
   are `stacks-router`, `stacks-actions`, `stacks-models`, `stacks-database`, `stacks-jobs`,
   `stacks-events`, `stacks-realtime`, and `stacks-cloud`.
3. Draw one question per diagram. For a runtime overview, prefer browser or client -> stx/router ->
   action or service -> model/query -> database, then add only the external systems and trust
   boundaries that story needs.
4. Write output to the user's requested path. When no path is given, use
   `docs/public/diagrams/<descriptive-name>/index.html` and keep the source JSON beside it. That
   path matters: BunPress only renders `docs/**/*.md` and copies `docs/public/**`, so a diagram
   written anywhere else under `docs/` never reaches the built site. The directory-plus-`index.html`
   shape is what the deployed docs host serves at the clean URL
   `/docs/diagrams/<descriptive-name>`; a bare `<name>.html` is redirected to an extensionless path
   that does not exist. Link to it from a docs page as `/diagrams/<descriptive-name>` (BunPress adds
   the `/docs` base).

To pin architecture nodes to real code, pass `--repo-root .` and author `meta.repository`; nodes then
mark themselves `SRC n` and open Git-verified files and line ranges at one pinned commit. See
`references/authoring-contract.md`.

## Type router

| Type | Use for |
|---|---|
| `architecture` | Components, services, cloud/security boundaries, infrastructure |
| `workflow` | Processes, approval gates, tool calls, runbooks, CI/CD, incident response |
| `sequence` | API call chains, request lifecycles, cache fallback, async traces, returns |
| `dataflow` | Pipelines, ETL/ELT, lineage, PII and governance boundaries, consumers |
| `lifecycle` | State/status transitions, retries, waiting and terminal states |

Trigger phrases: "architecture/system/cloud diagram" -> `architecture` (unless clearly
process-oriented). "workflow/flow/process/runbook/approval/CI-CD/incident" -> `workflow`.
"sequence/interaction/call chain/who calls whom" -> `sequence`. "data
flow/pipeline/ETL/lineage/PII/governance" -> `dataflow`. "state/status/lifecycle/state
machine/retry/terminal" -> `lifecycle`.

## Mermaid input

Read Mermaid for topology and meaning, then author fresh JSON. Do not parse or re-render Mermaid
styling.

- `flowchart` / `graph` -> `workflow`, or `architecture` for a component map. `subgraph` becomes a
  lane or a boundary; a diamond node becomes a decision or security node.
- `sequenceDiagram` -> `sequence`. `participant` becomes a semantic participant, `->>` a message,
  `-->>` a `return` variant, `Note` a message note, `rect` a segment.
- `stateDiagram` -> `lifecycle`. `[*]` becomes the `start` type or the `terminal` lane; transition
  labels stay event-like.

Drop Mermaid styling and keep only topology and meaning. Grouping, lane order, and emphasis are your
judgment, and that judgment is the product.

## Authoring invariants

- One obvious main path; side branches leave the nearest main-path node. Remove low-value edges
  before adding routing controls. If a diagram needs 20+ edges, remove edges until the main path is
  obvious.
- Detail belongs in summary `cards`, not in extra arrows.
- Omit `meta.visual_preset` by default so every diagram opens in `classic`. Color mode and visual
  preset are independent: switching light/dark preserves the preset. Set `signal-flow`, `blueprint`,
  or `editorial` only when the user asks for that style.
- Omit `meta.subtitle` by default. Never invent one that restates the title, nodes, or cards.
- Omit `meta.legend` for the truthful `auto` default. When needed, use only `mode: auto|all|hidden`
  and renderer-supported `entries.<kind>.label|visible`. Labels never change semantics.
- Component types are `frontend`, `backend`, `database`, `cloud`, `security`, `messagebus`,
  `external`. Variants are `default`, `emphasis`, `security`, `dashed`.
- Relationship labels are semantic data. When one collides, move the label, adjust the route or
  spacing, then shorten the wording while preserving meaning. Delete wording only when both endpoints
  fully imply it and it carries no protocol, action, direction, sync/async behavior, or
  cross-boundary mechanism. Deleting a meaningful label is not a geometry repair.
- Spacing means clear gap, not center distance. A label's clear gap must exceed its measured mask
  width.
- Automatic routes own their endpoint sides: the first and final segment leave and enter
  perpendicular to that side. Automatic Port Spread is default behavior for architecture, workflow,
  dataflow, and lifecycle; it stands down for explicit `via`, `channelX`, `channelY`, `labelAt`, or a
  non-`auto` route.
- Never accept an edge crossing an unrelated opaque node, an ambiguous shared corridor, or a label
  masking another route.
- For sequence diagrams, omit `meta.column_fit` for the stable `fixed` layout. Set `"spread"` when a
  wide viewBox leaves unused horizontal space or meaningful participant labels do not fit; do not
  shorten semantic labels first.
- Lifecycle phase columns `0..4` occupy the main rail; an event or terminal column `N` in `0..2`
  aligns beneath main column `N + 2`. A recoverable state uses `type: "failure"` plus a real
  transition back to the active state.
- Omit `meta.engineering_profile` by default. Enable `deployment-ownership` only when the user
  explicitly asks for production deployment topology, ownership handoff, or a fail-closed deployment
  review, and the facts are known. It fails closed on missing owners, region placement, private
  database scope, or named crossings; repair the facts rather than removing the profile.
- Set `meta.animation: "trace"` only for a demo or presentation view. It respects
  `prefers-reduced-motion` and leaves static output unchanged.
- `meta.views` is optional: at most five curated chapters built from stable node IDs.
- `meta.locale` (`en` or `zh-CN`) localizes renderer-owned viewer UI only, never authored content.
  For any other language, omit it and say plainly that the fixed viewer UI and `<html lang>` fall
  back to English.
- Treat the artifact as a first-screen desktop composition. One responsive artifact serves laptops
  and external displays; never emit device-specific HTML or alternate topology. Before handoff the
  page must not scroll horizontally or vertically at 1440x900, 1600x1000, and 1920x1080 (plus
  2048x1320 for a large-display composition). Repair overflow by removing genuinely redundant content
  or compacting spacing before shrinking nodes or labels. Never counterfeit a pass with
  `overflow: hidden`, clipping, an internal scroller, a stretched SVG, or smaller typography.

Read `references/authoring-contract.md` only when you need field enums, spacing math, geometry repair
rules, repository evidence, or mode-specific placement.

## Delivery evidence

`deliver` freezes the specification bytes into a private same-directory snapshot, renders and checks
that snapshot, atomically commits the HTML, and reports SHA-256 plus byte counts for both
specification and artifact. It proves deterministic artifact checks; it does not exercise the viewer
in a browser.

```bash
.claude/skills/stacks-technical-diagrams/bin/diagrams visual-check <output.html> --json
```

`visual-check` drives a system Chrome over the DevTools Protocol against the exact delivered HTML,
without rerendering it, and writes screenshots plus a machine-readable receipt. It exits 2 (skipped)
when no Chrome is installed. Keep three claims separate: `deliver` proves artifact checks,
`visual-check` proves bounded browser behavior, and perceptual review requires a human or an
image-capable reviewer. Never run `visual-check` after a failed delivery: it would inspect the stale
last-good artifact.

For an active authoring loop, `preview` watches one JSON file on a random loopback port and reloads
only after a candidate passes every gate, keeping the last verified diagram visible through failures:

```bash
.claude/skills/stacks-technical-diagrams/bin/diagrams preview <type> <input>.json <output>.html --quality showcase
```

Never start `preview` by default. `deliver --open` is an opt-in one-shot handoff after commit. Full
receipt fields, coverage, sidecars, and exit behavior: `references/delivery-contract.md`.

## Architecture Delta

For design or PR review, compare two validated architecture snapshots as Before / Delta / After with
a machine receipt of exactly what was added, removed, changed, moved, and rerouted:

```bash
.claude/skills/stacks-technical-diagrams/bin/diagrams compare architecture base.json head.json delta.html --receipt delta.receipt.json --json
```

Component identity is `components[].id`, relationship identity is `connections[].id` (required for
compare), and boundary identity is derived from `kind` + `label`. The delta reports authored facts
only; it infers no impact, risk, or merge safety.

## Brand marks

Brand identity is optional and explicit. When a node names a real product, look up a canonical
built-in ID from the bundled catalogue of 107 marks:

```bash
.claude/skills/stacks-technical-diagrams/bin/diagrams brands "postgres" --json
```

Never infer a brand from a vague role such as "database", and never let a badge replace the semantic
`type`, label, or relationship facts. `brands capture <url>` is the one command in this skill that
makes a network request: it is user-initiated, it pins the result by SHA-256, and `render`,
`validate`, `deliver`, and `compare` never perform an unpinned capture. See
`references/brand-marks.md`.

## Dependency-free and offline contract

Do not install packages or fetch runtime assets. Standalone validators for all five schemas are
checked in, the renderers use Bun's Node compatibility modules, and delivered HTML embeds its own
subsetted JetBrains Mono, so a page renders with no network access. Upstream's update-notifier
scripts are deliberately not vendored: this port is pinned by `metadata.source_commit` and is updated
by re-porting, never by a runtime download.

Verify the install with `diagrams doctor`, and generate a ready-to-open example with
`diagrams demo <output-directory>` before the first custom diagram.

## Deeper references

Read one of these only when the fast path calls for it.

| Need | Read |
|---|---|
| Field enums, spacing math, geometry repair, repository evidence, placement | `references/authoring-contract.md` |
| Receipt fields, coverage, sidecars, exit behavior, preview, export receipts | `references/delivery-contract.md` |
| Share cards, route/reach cards, motion, stories, deep links, presentation | `references/viewer-runtime.md` |
| Brand catalogue rules and capture | `references/brand-marks.md`, `brand-marks/README.md` |
| Per-mode layout budgets, route presets, semantic types | `renderers/<mode>/README.md` |
| IR overview across all five modes | `schemas/README.md` |

## Hand-placed fallback (no Bun available)

When the CLI cannot run, copy `assets/template.html`, place SVG by hand using the design system
below, and run the self-review checklist before delivering.

**The cardinal rule: CSS classes, not inline colors.** The theme toggle switches CSS custom
properties, so `fill="rgba(...)"` or `stroke="#22d3ee"` will not follow the theme.

```svg
<rect x="X" y="Y" width="W" height="H" rx="6" class="c-mask"/>
<rect x="X" y="Y" width="W" height="H" rx="6" class="c-backend" stroke-width="1.5"/>
<text x="CX" y="CY" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">API Server</text>
<text x="CX" y="CY+16" class="t-muted" font-size="9" text-anchor="middle">FastAPI :8000</text>
```

Component fills `c-frontend`, `c-backend`, `c-database`, `c-cloud`, `c-security`, `c-messagebus`,
`c-external`; text accents `t-<same>` plus `t-primary` / `t-muted` / `t-dim`. Arrows `a-default`,
`a-emphasis` (hot path), `a-security` (dashed), `a-dashed` (async), each with an explicit
`stroke-width` and a matching `marker-end="url(#arrowhead[-variant])"`. Boundaries:
`c-security-group` (dashed rose), `c-region` (dashed amber), `c-lane`. Typography inherits JetBrains
Mono from the SVG root: 11-12px component names, 9px sublabels, 8px annotations, 7px tiny labels.

Hard layout rules: an opaque `c-mask` rect immediately before every styled `c-<type>` rect; all
arrows before all component rects in document order; at least 40px vertical gap between components;
boundary `y` = inner `y` - 30 and boundary `height` = inner `height` + 50 with the label baseline 18px
below the boundary top; the legend outside every boundary and at least 20px below the lowest one.

Self-review before delivering:

1. `grep -E 'fill="(#|rgb)|stroke="(#|rgb)' out.html` inside the SVG returns nothing but the
   template's own defs.
2. Every `c-<type>` rect has an identical-geometry `c-mask` rect immediately before it.
3. All arrows appear before all component rects in document order.
4. max(y + height) over all SVG elements is at least 20px inside the viewBox height; same for x.
5. Legend y is below every boundary's y + height.
6. The `.toolbar`, `<script>` blocks, and `:root` / `[data-theme]` CSS are untouched. They are the
   theme toggle, viewer, and export menu.

## Output

Report the checked HTML path, the diagram type, the validation summary, the specification and
artifact receipt, the browser-evidence status, and a truthful visual-review status. Never claim
success for a non-zero command, and never claim a visual inspection you did not perform.
