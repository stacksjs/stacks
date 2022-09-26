# The CLI API

```bash
# pnpm artisan make:component HelloWorld # bootstraps HelloWorld.vue component
# pnpm artisan make:function hello-world # bootstraps hello-world.ts function
# pnpm artisan make:stack hello-world # bootstraps component & function

# pnpm artisan install # installs all deps
# pnpm artisan update # updates the stack to the latest version
# pnpm artisan clean # cleans all deps & dist folders
# pnpm artisan fresh # cleans & reinstalls all deps

# pnpm artisan dev # stubs everything & and starts smart dev server
# pnpm artisan dev:components # stubs components
# pnpm artisan dev:web-components # stubs components
# pnpm artisan dev:docs # starts docs dev server & opens docs in browser

# pnpm artisan build # runs typecheck & builds the project
# pnpm artisan build:components # builds component library
# pnpm artisan build:functions # builds function library
# pnpm artisan build:web-components # builds web components/custom elements library
# pnpm artisan build:docs # builds the docs

# pnpm artisan deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# pnpm artisan deploy:docs # zero-config: Netlify & Vercel

# pnpm artisan commit # Be a good commitizen. GUI for git commits.
# pnpm artisan release # GUI for releasing the libraries & triggers npm releases
# pnpm artisan changelog # automatically generates changelog

# pnpm artisan lint # lints the codebase
# pnpm artisan lint:fix # auto-fixes lint errors
# pnpm artisan test:types # runs typecheck
# pnpm artisan types:fix # wip

# pnpm artisan test # runs whole test suite
# pnpm artisan test:e2e # runs e2e tests
# pnpm artisan test:unit # runs unit tests
# pnpm artisan test:coverage # runs test coverage

# pnpm artisan example # run an example script (follow prompts)

# pnpm artisan preinstall # the preinstall hook that ensures proper node & pnpm versions are installed
# pnpm artisan postinstall # the postinstall hook that ensures git hooks are configured after initial install
```
