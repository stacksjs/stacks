# The Buddy CLI

```bash
buddy --version # get the Stacks version
buddy --help # view help menu
# please note: you may suffix any command with the
# `command --help` flag to review the help menu

buddy install # installs dependencies
buddy add # adds a stack or dependency
buddy fresh # fresh reinstall of all deps
buddy clean # removes all deps

buddy upgrade # upgrades all dependencies
buddy upgrade -i # prompts you to select which updates to apply (wip)
buddy upgrade:dependencies # auto-upgrades deps & the Stacks framework
buddy upgrade:framework # auto-upgrades deps & the Stacks framework
buddy upgrade:search-engine # auto-upgrades configured search engine
buddy upgrade:bun # upgrades to latest project-defined Bun version
buddy upgrade:all # auto-upgrades all of the above

# if you need any more info on any command listed here, you may suffix
# any of them via the "help option", i.e. `buddy ... --help`

buddy dev # starts the frontend dev server
buddy dev -i # prompts any of the dev servers (components, functions, views, or docs)
buddy dev:api # starts the API dev server
buddy dev:dashboard # starts the Admin/Dashboard dev server
buddy dev:desktop # starts the Desktop dev server
buddy dev:views # starts frontend dev server
buddy dev:components # starts component dev server
buddy dev:functions # stubs functions
buddy dev:docs # starts local docs dev server
buddy dev docs # also starts the local docs dev server (colon is optional)
buddy development # `buddy dev` alias

# for Laravel folks, `serve` may ring more familiar than the `dev` name. Hence, we aliased it:
buddy serve
buddy serve:components
buddy serve:desktop
buddy serve:views
buddy serve:functions
buddy serve:docs

# building for production (e.g. AWS, Google Cloud, npm, Vercel, Netlify, et al.)
buddy build # select a specific build (follow CLI prompts)
buddy build:views # builds SSG views
buddy build:desktop # builds Desktop application
buddy build:library # builds any or all libraries
buddy build:functions # builds function library
buddy build:components # builds Vue component library & Web Component library
buddy build:web-components # builds framework agnostic Web Component library (i.e. Custom Elements)
buddy build:vue-components # builds Vue 2 & 3-ready Component library
buddy build:cli # builds the user's CLI
buddy build:cli --buddy # builds the Buddy CLI
buddy build:all # builds all your code

# `buddy build` aliases
buddy prod
buddy prod:components
buddy prod:desktop
buddy prod:library
buddy prod:views
buddy prod:functions
buddy prod:vue-components
buddy prod:web-components
buddy prod:all
buddy prod:cli
buddy prod:cli --buddy
buddy production # `buddy prod` alias

# sets your application key
buddy key:generate

buddy make:component HelloWorld # bootstraps a HelloWorld component
buddy make:function hello-world # bootstraps a hello-world function
buddy make:view hello-world # bootstraps a hello-word page
buddy make:model Car # bootstraps a Car model
buddy make:database cars # creates a cars database
buddy make:migration create_cars_table # creates a cars migration file
buddy make:factory cars # creates a Car factory file
buddy make:table cars # bootstraps a cars data table
buddy make:notification welcome-email # bootstraps a welcome-email notification
buddy make:lang de # bootstraps a lang/de.yml language file
buddy make:stack my-project # shares logic with `bunx stacks new my-project`

buddy migrate # runs database migrations
buddy migrate:dns # sets the ./config/dns.ts file

buddy dns example.com # list all DNS records for example.com
buddy dns example.com --type MX # list MX records for example.com (proxies dog)

buddy https httpie.io/hello
# http [flags] [METHOD] URL [ITEM [ITEM]]
buddy http --help
buddy http PUT pie.dev/put X-API-Token:123 name=John # Custom HTTP method, HTTP headers and JSON data
buddy http -v pie.dev/get # See the request that is being sent using one of the output options
buddy http -f POST pie.dev/post hello=World # submitting forms
buddy http --offline pie.dev/post hello=offline
buddy http -a USERNAME POST https://api.github.com/repos/httpie/cli/issues/83/comments body='HTTPie is awesome! :heart:'
buddy http pie.dev/post < files/data.json
buddy http pie.dev/image/png > image.png
buddy http --download pie.dev/image/png
buddy http --session=logged-in -a username:password pie.dev/get API-Key:123
buddy http --session=logged-in pie.dev/headers
buddy http localhost:8000 Host:example.com

buddy lint # runs linter
buddy lint:fix # runs linter and fixes issues

buddy commit # follow CLI prompts for committing staged changes
buddy release # creates the releases for the stack & triggers the Release Action (workflow)
buddy changelog # generates CHANGELOG.md

# when deploying your app/s to a remote server or cloud provider
buddy deploy # select a specific deployment (follow CLI prompts)
# buddy deploy:docs # deploys docs to AWS (or other configured provider)
# buddy deploy:functions # deploys functions to AWS (or other configured provider)
# buddy deploy:views # deploys views to AWS (or other configured provider)
# buddy deploy:all # deploys all your code
buddy undeploy # be careful: "undeploys" removes/deletes your deployed resources

buddy cloud:remove # removes cloud setup
buddy cloud:cleanup # removes cloud setup & cleans up all potentially leftover resources
buddy cloud:add --jump-box # adds a jump box to your cloud setup

# select the example to run (follow CLI prompts)
buddy example # prompts you to select which example to run
buddy example:vue # runs the Vue example
buddy example:web-components # runs the Web Component example

# you likely won't need to run these commands as they are auto-triggered, but they are available
buddy generate  # prompts you to select which generator to run
buddy generate:entries # generates entry files for components, functions, & views
buddy generate:web-types # generates Web Component types
buddy generate:vscode-custom-data # generates VSCode custom data
buddy generate:ide-helpers # generates IDE helpers
buddy generate:component-meta # generates component meta
buddy generate:all # runs all generators

# generates your application key
buddy key:generate # generates your application key

# generate your TypeScript declarations
buddy types:generate # generates types for your components, functions, & views
buddy types:fix # auto-fixes types for your components, functions, & views

buddy domains # alias for `buddy domains:list`
buddy domains:add stacksjs.org # adds a domain
buddy domains:remove stacksjs.org # removes a domain
buddy domains:list # lists all domains
buddy domains:update # apply ./config/dns.ts updates
buddy domains:purchase stacksjs.org # purchase a new domain

# test your stack
buddy test # runs test suite (unit & e2e)
buddy test:coverage # runs test coverage
buddy test:types # runs typecheck

# the CLI may be triggered in any
# of the following syntax:
stx fresh
buddy fresh
bud fresh
buddy fresh
```
