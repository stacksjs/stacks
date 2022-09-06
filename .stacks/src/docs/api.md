# The CLI API

```bash
# npx artisan make:component HelloWorld # bootstraps HelloWorld.vue component
# npx artisan make:function hello-world # bootstraps hello-world.ts function
# npx artisan make:stack hello-world # bootstraps component & function

# npx artisan install # installs all deps
# npx artisan update # updates the stack to the latest version
# npx artisan clean # cleans all deps & dist folders
# npx artisan fresh # cleans & reinstalls all deps

# npx artisan dev # stubs everything & and starts smart dev server 
# npx artisan dev:components # stubs components
# npx artisan dev:functions # stubs functions
# npx artisan dev:elements # stubs components
# npx artisan dev:playground # starts dev server & opens Stacks playground
# npx artisan dev:docs # starts docs dev server & opens docs in browser
# npx artisan dev:stacks # stubs the framework
# npx artisan stubs # stubs everything

# npx artisan build # runs typecheck & builds the project
# npx artisan build:components # builds component library
# npx artisan build:functions # builds function library
# npx artisan build:elements # builds web components/custom elements library
# npx artisan build:playground # builds the playground
# npx artisan build:docs # builds the docs
# npx artisan build:stacks # builds the framework

# npx artisan deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# npx artisan deploy:docs # zero-config: Netlify & Vercel
# npx artisan deploy:playground # zero-config: Netlify & Vercel

# npx artisan commit # Be a good commitizen. GUI for git commits.
# npx artisan release # GUI for releasing the libraries & triggers npm releases
# npx artisan changelog # automatically generates changelog

# npx artisan lint # lints the codebase
# npx artisan lint:fix # auto-fixes lint errors
# npx artisan typecheck # runs typecheck
# npx artisan types:fix # wip

# npx artisan test # runs whole test suite
# npx artisan test:e2e # runs e2e tests
# npx artisan test:unit # runs unit tests
# npx artisan test:coverage # runs test coverage

# npx artisan example # run an example script (follow prompts)

# npx artisan preinstall # the preinstall hook that ensures proper node & pnpm versions are installed 
# npx artisan postinstall # the postinstall hook that ensures git hooks are configured after initial install
```
