# The CLI API

```bash
# pnpm buddy make:component HelloWorld # bootstraps HelloWorld.vue component
# pnpm buddy make:function hello-world # bootstraps hello-world.ts function
# pnpm buddy make:stack hello-world # bootstraps component & function

# pnpm buddy install # installs all deps
# pnpm buddy update # updates the stack to the latest version
# pnpm buddy clean # cleans all deps & dist folders
# pnpm buddy fresh # cleans & reinstalls all deps

# pnpm buddy dev # stubs everything & and starts smart dev server
# pnpm buddy dev:components # stubs components
# pnpm buddy dev:web-components # stubs components
# pnpm buddy dev:docs # starts docs dev server & opens docs in browser

# pnpm buddy build # runs typecheck & builds the project
# pnpm buddy build:components # builds component library
# pnpm buddy build:functions # builds function library
# pnpm buddy build:web-components # builds web components/custom elements library
# pnpm buddy build:docs # builds the docs

# pnpm buddy deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# pnpm buddy deploy:docs # zero-config: Netlify & Vercel

# pnpm buddy commit # Be a good commitizen. GUI for git commits.
# pnpm buddy release # GUI for releasing the libraries & triggers npm releases
# pnpm buddy changelog # automatically generates changelog

# pnpm buddy lint # lints the codebase
# pnpm buddy lint:fix # auto-fixes lint errors
# pnpm buddy test:types # runs typecheck
# pnpm buddy types:fix # wip

# pnpm buddy test # runs whole test suite
# pnpm buddy test:e2e # runs e2e tests
# pnpm buddy test:unit # runs unit tests
# pnpm buddy test:coverage # runs test coverage

# pnpm buddy example # run an example script (follow prompts)

# pnpm buddy preinstall # the preinstall hook that ensures proper node & pnpm versions are installed
# pnpm buddy postinstall # the postinstall hook that ensures git hooks are configured after initial install
```
