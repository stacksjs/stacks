# Stacks documentation

`@stacksjs/docs` supplies BunPress defaults and native branded component guides.

The root export provides `frameworkDefaults`, `docsConfig` and metadata constants.
Configure the documentation site with `BunPressOptions` from `@stacksjs/bunpress`.

## Component style guides

Create `config/style-guide.ts` using `StyleGuideConfig` from
`@stacksjs/docs/style-guide`, then run:

```bash
buddy docs:style-guide
buddy docs:style-guide:check
```

The guide discovers production STX components, documents explicit public
contracts, renders isolated `.story.stx` variants and reads the application's
own design tokens and styles. Application stores are not auto-loaded into
previews. `buddy build --docs` generates configured guides automatically.

Generated Markdown, a sidebar inventory, sandboxed public previews, local
assets and a JSON catalog are tracked by an ownership manifest. Freshness
checks are read-only; regeneration removes only stale owned outputs and keeps
authored documentation intact.

See [the complete configuration and story conventions](https://stacksjs.com/docs/basics/style-guide).
The programmatic API exports `loadStyleGuideConfig`, `generateStyleGuide`,
`runStyleGuide` and `styleGuideCssTokens` from `@stacksjs/docs/style-guide`.

## Tests

```bash
bun test ./storage/framework/core/docs/tests
```

MIT license. Contributions follow the Stacks repository conventions.
