---
title: "Engineering craft skills"
description: "How the work happens: planning, building, debugging, reviewing, handing off."
---
# Engineering craft

How the work happens: planning, building, debugging, reviewing, handing off.

These shape *how* the work happens rather than which subsystem it touches. Where
the other sections answer "which package", these answer "what do I do now".
[Flow](/skills/craft/flow) is the router over them, and
[Flows](/skills/flows) walks the routes they form.

34 skills.

| Skill | What it is for |
|---|---|
| [Browse](/skills/craft/browse) | Headless browser QA with nothing to install. It drives a Chromium-family browser already on the machine over the Chrome DevTools Protocol using only Bun, so navigation, screenshots, responsive checks, console and network monitoring and accessibility snapshots all work without Playwright or Puppeteer. |
| [Codebase design](/skills/craft/codebase-design) | The shared vocabulary for designing deep modules: a lot of behaviour behind a small interface, at a clean seam, testable through that interface. |
| [Domain modeling](/skills/craft/domain-modeling) | Build and sharpen the project's domain language, and record the decisions that are hard to reverse. |
| [Flow](/skills/craft/flow) | The router over more than a hundred skills. It names the flows: the main route from idea to shipped, the on-ramps that feed into it, and the vocabulary skills that run underneath. |
| [Grilling](/skills/craft/grilling) | A relentless interview that stress-tests a plan before any code exists. |
| [Guard](/skills/craft/guard) | Safety rails, in two layers. The catalogue tells the agent which commands are catastrophic, which merely warrant a warning, and which are worth noting. |
| [Handoff](/skills/craft/handoff) | Compacts the conversation into a portable document another session can pick up, written to the OS temp directory rather than the repo. |
| [Humanizer](/skills/craft/humanizer) | Broad editorial rewrites using 26 contextual AI-writing patterns while preserving claims and the writer's voice. |
| [Investigate](/skills/craft/investigate) | Root-cause debugging, structured so the hard part comes first. |
| [New feature](/skills/craft/new-feature) | The end-to-end build. Slice the work into tracer bullets first, each cutting a narrow but complete path through model, migration, action, route and test, then build them one at a time off the frontier. |
| [Office hours](/skills/craft/office-hours) | A product thinking partner that produces design documents and never code. |
| [Plan review](/skills/craft/plan-review) | Architecture review at two levels: are we building the right thing, and are we building it right. |
| [Prototype](/skills/craft/prototype) | Throwaway code that answers exactly one design question. Two branches: a single shareable HTML file that lets a non-developer drive a state model by clicking buttons, or several radically different stx variants of one view. |
| [Retro](/skills/craft/retro) | A retrospective that proposes changes to the environment rather than to the person. |
| [Review](/skills/craft/review) | Two-axis review of a diff. Standards asks whether the code follows this repo's rules and stays clear of the Fowler smell baseline. |
| [Security audit](/skills/craft/security-audit) | Security analysis that has to show its work. OWASP Top 10, STRIDE threat modelling, attack-surface mapping and a dependency audit, with the rule that every finding carries a concrete exploit scenario rather than a category name. |
| [TDD](/skills/craft/tdd) | The red-green discipline, as opposed to the test utilities that [Testing](/skills/toolchain/testing) documents. |
| [Unslop](/skills/craft/unslop) | Contextual prose audits, minimal rewrites, and teach/mimic voice workflows with factual preservation. |
| [Wizard](/skills/craft/wizard) | For the steps only a human can take: cloud credentials, a registrar's nameservers, SES verification, CI secrets, a one-off cutover. |
| [Writing for agents](/skills/craft/writing-for-agents) | The skill for writing skills, and for every other document an agent reads. |
| [Grill With Docs](/skills/craft/grill-with-docs) | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go. |
| [Implement](/skills/craft/implement) | Implement a piece of work based on a spec or set of tickets. |
| [Implement Spec](/skills/craft/implement-spec) | Implement the result of /to-spec and /to-tickets in code. |
| [Improve Codebase Architecture](/skills/craft/improve-codebase-architecture) | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick. |
| [PR](/skills/craft/pr) | writing a PR body. |
| [Research](/skills/craft/research) | investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent. |
| [Scaffold Exercises](/skills/craft/scaffold-exercises) | create exercise directory structures with sections, problems, solutions, and explainers that pass linting. Use when user wants to scaffold exercises, create exercise stubs, or set up a new course section. |
| [Setup Deep Modules](/skills/craft/setup-deep-modules) | Configure and prove public-entrypoint, fixture, and dependency-cycle checks. |
| [Setup Engineering](/skills/craft/setup-engineering) | Configure tracker conventions, triage roles, and domain documentation when needed. Local Markdown remains a usable fallback. |
| [Test Fixtures](/skills/craft/test-fixtures) | Replace unsafe assertions with valid typed fixtures while preserving malformed-input tests. |
| [To Spec](/skills/craft/to-spec) | Turn the current conversation into a spec and publish it to the project issue tracker - no interview, just synthesis of what you've already discussed. |
| [To Tickets](/skills/craft/to-tickets) | Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker (edges as text in one file per ticket locally, or native blocking links on a real tracker). |
| [Triage](/skills/craft/triage) | Move issues and external PRs through a state machine of triage roles, categorise, verify, grill if needed, and write agent-ready briefs. |
| [Wayfinder](/skills/craft/wayfinder) | Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
