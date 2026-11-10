---
title: Generated component style guides
description: Generate a branded component inventory, design tokens and isolated STX previews from production sources.
---

# Generated component style guides

Stacks can publish your component reference alongside your application docs. It discovers `.stx` components, reads your production tokens and styles, and renders explicitly authored `.story.stx` examples with STX. Each installation supplies its own brand configuration.

## Configure the guide

Create `config/style-guide.ts`:

```ts
import type { StyleGuideConfig } from '@stacksjs/docs/style-guide'

export default {
  brand: {
    name: 'Example training',
    description: 'The components used by our training application.',
    accent: '#2457e8',
    font: 'system-ui, sans-serif',
  },
  sources: [
    { id: 'app', directory: 'resources/components', label: 'Application' },
  ],
  stories: ['resources/style-guide'],
  tokens: {
    Colors: [{ name: 'action', value: '#2457e8', description: 'Primary action fill' }],
  },
  styles: { files: ['resources/assets/styles/components.css'] },
  output: { publicUrl: '/docs/style-guide/generated' },
} satisfies StyleGuideConfig
```

Import token values from the same theme module as production. The values in this example only demonstrate the configuration shape. `styleGuideCssTokens(css, selector?)` extracts custom properties from a declaration block (`:root` by default); a missing block is an error. `styles.css` accepts CSS computed from a theme helper. Utility CSS comes from the project's STX/ts-css configuration; disable it with `styles.utilities: false` for a CSS-only library.

Source IDs are unique lowercase slugs. A component's stable identity combines the source ID and its relative path, so `app/button` and `ui/button` remain distinct. Optional `exclude` globs are relative to their source root. Explicit library roots can point to installed packages; no dependency is copied or patched. Missing roots fail the build instead of silently dropping coverage.

The default generated directories are `docs/style-guide/generated` and `docs/public/style-guide/generated`. Authored pages beside them remain intact. `output.docs`, `output.public` and `output.route` can change the destinations. `output.route` is the BunPress route without its mount prefix; `output.publicUrl` includes the actual public prefix, such as `/docs`. Keep output directories separate and inside the application. The generator rejects symlink outputs, unowned file collisions and unsafe ownership paths.

## Author isolated examples

Put stories beside a component or in a configured stories directory:

```stx
<script client>
const saved = state(false)
</script>

<!--
@prop {'primary' | 'secondary'} variant Semantic action role.
@event click Activates the action in the caller's scope.
-->
<Story title="Actions" group="Controls" component="app/button">
  <Variant title="Primary">
    <Button @click="saved.set(true)">Save example</Button>
    <p role="status" :text="saved ? 'Saved locally.' : 'Ready'"></p>
  </Variant>
  <Variant title="Disabled">
    <Button disabled="true">Save example</Button>
  </Variant>
</Story>
```

The optional `component` attribute associates the story and its annotations with a stable component ID. Each story needs explicit, nonempty `Variant` elements with unique titles. Stories without a component association document reusable patterns. STX's Story parser supplies titles, groups and variants; the production renderer renders the actual component. An unresolved component fails generation.

Fixtures are trusted build inputs: server scripts and component imports execute during rendering. Use fictional, local data and pure helpers. Never import authenticated stores, services or account-connected screens. Stacks disables automatic application-store discovery for previews. The published iframe uses a sandbox and a restrictive content policy, including blocked network connections and form submissions. These are browser previews, not native host certification.

`preview.componentDirs` sets component resolution order. `preview.appearances` can render every variant in multiple appearances, each with a name, body class, background and foreground. Without it, the guide uses `brand.background`, `brand.foreground` and `preview.bodyClass`. Provide local `/public` URLs for CSS assets. The generator copies and fingerprints referenced assets; remote CSS resources are rejected. Large STX runtime scripts are shared across examples.

## Document contracts accurately

Every discovered component receives a reference page, including components without safe previews. Those entries explicitly say **Reference only**. The guide reports the number of fixtures and variants, not a claim of complete behavior or accessibility coverage.

Public contracts can use these annotations in a component or its associated story:

```ts
/**
 * @description A compact action for a row.
 * @prop {string} label Accessible action text.
 * @event click Activates the action.
 */
```

The scanner also recognizes straightforward `interface Props` contracts used by `defineProps<Props>()`, `$props.name` reads and `useReactiveProp('name')`. A read without an explicit type is marked **Not declared**. Complex imported types, destructured props and computed prop access require annotations. Local variables and local signals are never presented as props. Slot outlets and child component tags come from STX's component analyzer. Public events require explicit `@event` documentation; internal handlers are not public contracts.

## Generate and check

```bash
buddy docs:style-guide
buddy docs:style-guide:check
buddy docs:style-guide --config config/another-guide.ts
```

`buddy build --docs` generates the guide before BunPress when `config/style-guide.ts` exists. Projects with an independent BunPress pipeline should run the generator before their docs build. Add `docs:style-guide:check` to package scripts and CI so a component or theme change cannot leave stale documentation behind. The release preflight keeps this application check enabled.

The read-only check fingerprints component/story source, resolved configuration, generated utility CSS, local asset bytes and the generator implementation. It verifies every manifest-owned output byte. Regeneration prunes only previously owned stale files, preserving authored pages. Commit the generated Markdown, public assets, catalog and manifest together. Regenerate after upgrading the framework as well as after changing source or theme values.

## Add navigation

The generated `sidebar.json` includes the foundations, pattern pages and every component page. After the first generation, import it into your `config/docs.ts` and add a sidebar group:

```ts
import styleGuide from '../docs/style-guide/generated/sidebar.json'

const group = { text: 'Component guide', collapsed: true, items: styleGuide }
```

Use `group` in your BunPress sidebar. The generated index links every entry even without sidebar integration. `catalog.json` in the generated public directory is a machine-readable reference; it contains stable IDs and story source, with no absolute project paths.

Build the docs site and inspect the iframe and direct preview URLs under the real mount prefix. Check desktop and narrow layouts, fonts, light/dark appearances, long labels, focus, disabled/busy states and the interaction of local examples. Use the application's native tests for native layout and platform behavior.
