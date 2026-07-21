---
title: The Buddy CLI
description: Use Buddy to develop, build, test, deploy, and maintain a Stacks application.
---
# The Buddy CLI

```bash
buddy --version # get the Stacks version
buddy --help # view help menu
# please note: you may suffix any command with the
# `command --help` flag to review the help menu

buddy new my-project # creates a new Stacks project
buddy install # installs dependencies
buddy add calendar # pulls a registered project-shaped stack into this project
buddy fresh # fresh reinstall of all deps (--force skips the confirmation)
buddy clean # removes all deps (--force skips the confirmation)

buddy upgrade # upgrades the Stacks framework (alias: buddy update)
buddy upgrade:dependencies # auto-upgrades package.json deps
buddy upgrade:shell # upgrades the shell integration
buddy upgrade:binary # upgrades the `stacks` binary
buddy upgrade:bun # upgrades to latest project-defined Bun version
buddy upgrade:all # auto-upgrades all of the above

# if you need any more info on any command listed here, you may suffix
# any of them via the "help option", i.e. `buddy ... --help`

buddy dev # starts the dev servers (frontend, api & docs)
buddy dev -i # prompts you to select which dev server to start
buddy dev:api # starts the API dev server
buddy dev:dashboard # starts the Admin/Dashboard dev server
buddy dev:desktop # starts the Desktop dev server
buddy dev:views # starts frontend dev server
buddy dev:components # starts component dev server
buddy dev:docs # starts local docs dev server
buddy dev docs # also starts the local docs dev server (dev takes the server name as an argument)

# production servers (the same entries the deploy target runs as services)
buddy serve # starts the production HTTP server (STX views + /api proxy)
buddy serve:api # starts the production API server

# building for production (e.g. AWS, Google Cloud, npm, Vercel, Netlify, et al.)
buddy build # select a specific build (follow CLI prompts)
buddy build:frontend # builds the frontend (aliases: build:views, build:pages)
buddy build:desktop # builds Desktop application
buddy build:functions # builds function library
buddy build:components # builds STX component library & Web Component library
buddy build:web-components # builds framework agnostic Web Component library (i.e. Custom Elements)
buddy build:cli # builds the Buddy CLI binary
buddy build:server # builds the Stacks cloud server (Docker image)
buddy build:docs # builds the documentation site

# `buddy build:*` aliases
buddy prod:components # alias for build:components
buddy prod:desktop # alias for build:desktop
buddy prod:web-components # alias for build:web-components
buddy prod:frontend # alias for build:frontend
buddy prod:cli # alias for build:cli
buddy prod:server # alias for build:server
buddy prod:docs # alias for build:docs
buddy prod:frontend-static # alias for build:frontend-static

# sets your application key
buddy key:generate

buddy make:component HelloWorld # bootstraps a HelloWorld component
buddy make:function hello-world # bootstraps a hello-world function
buddy make:view hello-world # bootstraps a hello-word page
buddy make:model Car # bootstraps a Car model
buddy make:database cars # prints guidance: tables come from models + migrations, there is no separate create step
buddy make:migration create_cars_table # creates a cars migration file
buddy make:factory cars # creates a Car factory file
buddy make:notification welcome-email # bootstraps a welcome-email notification
buddy make:lang de # bootstraps a lang/de.yml language file
buddy make:stack my-plugin # scaffolds a project-shaped registry stack (new project? use `panx @stacksjs/buddy new`)

buddy migrate # runs database migrations
buddy migrate:fresh # drops all tables & re-runs migrations (destroys all data; --seed reseeds)
buddy migrate:dns # sets the ./config/dns.ts file
buddy seed # runs database seeders

buddy dns example.com # list all DNS records for example.com
buddy dns example.com --type MX # list MX records for example.com

buddy http example.com/api/hello # sends a GET request & prints the response
buddy http -v example.com/api/get # same, with verbose output

buddy lint # runs linter
buddy lint:fix # runs linter and fixes issues
buddy format # formats your project codebase
buddy format:check # checks formatting without making changes

buddy commit # follow CLI prompts for committing staged changes
buddy release # creates the releases for the stack & triggers the Release Action (workflow)
buddy changelog # generates CHANGELOG.md

# when deploying your app/s to a remote server or cloud provider
buddy deploy # select a specific deployment (follow CLI prompts)
buddy undeploy # be careful: "undeploys" removes/deletes your deployed resources (--yes skips the confirmation)

buddy cloud:remove # removes cloud setup
buddy cloud:cleanup # removes cloud setup & cleans up all potentially leftover resources
buddy cloud:add --jump-box # adds a jump box to your cloud setup

# you likely won't need to run these commands as they are auto-triggered, but they are available
buddy generate  # prompts you to select which generator to run
buddy generate:types # generates types for your components, functions, & views
buddy generate:entries # generates entry files for components, functions, & views
buddy generate:web-types # generates Web Component types
buddy generate:vscode-custom-data # generates VSCode custom data
buddy generate:ide-helpers # generates IDE helpers
buddy generate:component-meta # generates component meta

# generates your application key
buddy key:generate # generates your application key

# generate your TypeScript declarations
buddy types:generate # generates types for your components, functions, & views
buddy types:fix # auto-fixes types for your components, functions, & views

buddy domains:add stacksjs.com # adds a domain
buddy domains:remove stacksjs.com # removes a domain
buddy domains:purchase stacksjs.com # purchase a new domain

# handy utilities
buddy doctor # runs health checks on your Stacks installation
buddy list # lists all available Buddy commands
buddy route:list # lists your routes
buddy ports # checks your project for port issues & misconfigurations
buddy outdated # lists outdated project dependencies
buddy env:check # checks your environment configuration & validates setup
buddy tinker # interactive REPL with the Stacks framework preloaded
buddy down # puts the app into maintenance mode
buddy up # brings the app out of maintenance mode

# test your stack
buddy test # runs your test suite
buddy test:unit # runs unit tests
buddy test:feature # runs feature tests
buddy test:types # runs typecheck

# the published @stacksjs/buddy package ships
# `buddy`, `bud`, & `stx` bins; inside this repo
# the CLI is invoked as ./buddy
./buddy fresh
```
