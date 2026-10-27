# Stacks STX component library

This package publishes the application's `resources/components/` as native STX custom elements.

From a source checkout, run `bun run build` in this directory to compile the components through the maintained Stacks STX library builder. To develop the source components, run `./buddy dev:components` from the application root.

The package exports `dist/index.js` and its TypeScript declarations. Release publication checks those entries in the actual package payload after the build, including the package's `files` rules. A failed build, missing export or failed publication fails the release.
