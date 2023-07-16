# The CLI API

```bash
# bun buddy make:component HelloWorld # bootstraps HelloWorld.vue component
# bun buddy make:function hello-world # bootstraps hello-world.ts function
# bun buddy make:stack hello-world # bootstraps component & function

# bun buddy install # installs all deps
# bun buddy update # updates the stack to the latest version
# bun buddy clean # cleans all deps & dist folders
# bun buddy fresh # cleans & reinstalls all deps

# bun buddy dev # stubs everything & and starts smart dev server
# bun buddy dev:components # stubs components
# bun buddy dev:web-components # stubs components
# bun buddy dev:docs # starts docs dev server & opens docs in browser

# bun buddy build # runs typecheck & builds the project
# bun buddy build:components # builds component library
# bun buddy build:functions # builds function library
# bun buddy build:web-components # builds web components/custom elements library
# bun buddy build:docs # builds the docs

# bun buddy deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# bun buddy deploy:docs # zero-config: Netlify & Vercel

# bun buddy commit # Be a good commitizen. GUI for git commits.
# bun buddy release # GUI for releasing the libraries & triggers npm releases
# bun buddy changelog # automatically generates changelog

# bun buddy lint # lints the codebase
# bun buddy lint:fix # auto-fixes lint errors
# bun buddy test:types # runs typecheck
# bun buddy types:fix # wip

# bun buddy test # runs whole test suite
# bun buddy test:e2e # runs e2e tests
# bun buddy test:unit # runs unit tests
# bun buddy test:coverage # runs test coverage

# bun buddy example # run an example script (follow prompts)

# bun buddy preinstall # the preinstall hook that ensures proper node & pnpm versions are installed
# bun buddy postinstall # the postinstall hook that ensures git hooks are configured after initial install
```
