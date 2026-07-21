# Product Hunt launch kit

This document is the source of truth for the Stacks 1.0 Product Hunt launch. Publish it only after the 1.0 release is live and the final launch checks below pass.

## Listing

**Name:** Stacks

**Tagline:** Build full-stack products without the boilerplate

**Website:** https://stacksjs.com

**Topics:** Developer Tools, Open Source, Web Development

**Description:**

Stacks is an open-source TypeScript framework for building web apps, APIs, desktop apps, component libraries, and cloud infrastructure from one cohesive toolkit. It runs on Bun, uses STX for reactive templates, and includes Buddy for development, scaffolding, migrations, testing, builds, and deployment. Pantry provisions the required toolchain so each project is reproducible from the first command.

## Maker comment

Hi Product Hunt,

We built Stacks because modern product teams still spend too much time assembling and maintaining the same framework plumbing.

Stacks brings the application, API, data, frontend, CLI, and deployment layers into one TypeScript framework. Buddy gives the project one command surface, STX provides reactive server and browser templates without Vue, and Pantry installs the exact Bun, Git, SQLite, and feature-specific tools the project declares. Local development keeps friendly HTTPS URLs through rpx and tlsx.

The framework is open source and designed to stay understandable. Models drive migrations, project files override framework defaults, and optional project-shaped stacks install through `buddy add` without hiding what was added.

Today you can use Stacks to:

- Build STX web interfaces, APIs, and full-stack applications
- Define models, generate migrations, seed data, and expose typed routes
- Scaffold actions, jobs, middleware, mail, notifications, and components
- Develop locally with friendly HTTPS URLs and live reload
- Build CLIs, desktop apps, libraries, docs, and production servers
- Provision and deploy the infrastructure those products need

We would especially value feedback on onboarding, framework conventions, and the Buddy command experience. Thank you for taking a look.

## Gallery plan

1. Product overview using the Stacks social card and the line "One toolkit from idea to production."
2. Buddy terminal showing `panx @stacksjs/buddy new`, `buddy doctor`, and `buddy dev`.
3. STX editor and browser preview showing reactive state and Crosswind styles.
4. Model-to-API flow showing a model, generated migration, action, route, and test.
5. Project-shaped stack installation showing `buddy add calendar` and the files added to the project.
6. Deployment overview showing application, API, database, DNS, and TLS ownership.

## Launch checks

- [ ] Stacks 1.0 packages and binaries are published.
- [ ] `panx @stacksjs/buddy new product-hunt-check` succeeds on a clean machine.
- [ ] `buddy doctor`, `buddy dev`, `buddy test`, and `buddy build` pass in the generated project.
- [ ] https://stacksjs.com, documentation, and the StackBlitz starter are healthy.
- [ ] The release notes and migration guide are published.
- [ ] Gallery images use current UI and command output.
- [ ] Maker profiles, launch date, and support coverage are confirmed.
- [ ] Links include campaign attribution and are tested from a signed-out browser.

## Links

- Website: https://stacksjs.com
- Documentation: https://stacksjs.com/docs
- GitHub: https://github.com/stacksjs/stacks
- StackBlitz: https://stackblitz.com/fork/github/stacksjs/stacks/tree/main/examples/stackblitz?startScript=dev&title=Stacks%20Starter
- Whitepaper: https://whitepaper.stacksjs.dev
