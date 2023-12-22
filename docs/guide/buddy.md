# The Buddy CLI

```bash
# buddy make:component HelloWorld # bootstraps HelloWorld.stx component
# buddy make:function hello-world # bootstraps hello-world.ts function
# buddy make:stack hello-world # bootstraps component & function

# buddy install # installs all deps
# buddy update # updates the stack to the latest version
# buddy clean # cleans all deps & dist folders
# buddy fresh # cleans & reinstalls all deps

# buddy dev # stubs everything & and starts smart dev server
# buddy dev:components # stubs components
# buddy dev:web-components # stubs components
# buddy dev:docs # starts docs dev server & opens docs in browser

# buddy build # runs typecheck & builds the project
# buddy build:components # builds component library
# buddy build:functions # builds function library
# buddy build:web-components # builds web components/custom elements library
# buddy build:docs # builds the docs

# buddy deploy:functions # zero-config: Netlify, Vercel, AWS, Cloudflare (and more)
# buddy deploy:docs # zero-config: Netlify & Vercel

# buddy commit # Be a good commitizen. GUI for git commits.
# buddy release # GUI for releasing the libraries & triggers npm releases
# buddy changelog # automatically generates changelog

# buddy lint # lints the codebase
# buddy lint:fix # auto-fixes lint errors
# buddy test:types # runs typecheck
# buddy types:fix # wip

# buddy test # runs whole test suite
# buddy test:e2e # runs e2e tests
# buddy test:unit # runs unit tests
# buddy test:coverage # runs test coverage

# buddy example # run an example script (follow prompts)
```
