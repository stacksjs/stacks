# The CLI API

```bash
# pnpm stacks make:component HelloWorld # bootstraps HelloWorld.vue component
# pnpm stacks make:function hello-world # bootstraps hello-world.ts function
# pnpm stacks make:stack hello-world # bootstraps component & function

# pnpm stacks install # installs all deps
# pnpm stacks update # updates the stack to the latest version
# pnpm stacks clean # cleans all deps & dist folders
# pnpm stacks fresh # cleans & reinstalls all deps

# pnpm stacks dev # stubs everything & and starts smart dev server
# pnpm stacks dev:components # stubs components
# pnpm stacks dev:web-components # stubs components
# pnpm stacks dev:docs # starts docs dev server & opens docs in browser

# pnpm stacks build # runs typecheck & builds the project
# pnpm stacks build:components # builds component library
# pnpm stacks build:functions # builds function library
# pnpm stacks build:web-components # builds web components/custom elements library
# pnpm stacks build:docs # builds the docs

# pnpm stacks deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# pnpm stacks deploy:docs # zero-config: Netlify & Vercel

# pnpm stacks commit # Be a good commitizen. GUI for git commits.
# pnpm stacks release # GUI for releasing the libraries & triggers npm releases
# pnpm stacks changelog # automatically generates changelog

# pnpm stacks lint # lints the codebase
# pnpm stacks lint:fix # auto-fixes lint errors
# pnpm stacks test:types # runs typecheck
# pnpm stacks types:fix # wip

# pnpm stacks test # runs whole test suite
# pnpm stacks test:e2e # runs e2e tests
# pnpm stacks test:unit # runs unit tests
# pnpm stacks test:coverage # runs test coverage

# pnpm stacks example # run an example script (follow prompts)

# pnpm stacks preinstall # the preinstall hook that ensures proper node & pnpm versions are installed
# pnpm stacks postinstall # the postinstall hook that ensures git hooks are configured after initial install
```
