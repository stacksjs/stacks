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

18 skills.

| Skill | What it is for |
|---|---|
| [Browse](/skills/craft/browse) | Headless browser QA with nothing to install. It drives a Chromium-family browser already on the machine over the Chrome DevTools Protocol using only Bun, so navigation, screenshots, responsive checks, console and network monitoring and accessibility snapshots all work without Playwright or Puppeteer. |
| [Codebase design](/skills/craft/codebase-design) | The shared vocabulary for designing deep modules: a lot of behaviour behind a small interface, at a clean seam, testable through that interface. |
| [Domain modeling](/skills/craft/domain-modeling) | Build and sharpen the project's domain language, and record the decisions that are hard to reverse. |
| [Flow](/skills/craft/flow) | The router over every other skill. You will not remember a hundred and fifteen of anything, so this one names the flows instead: the main route from idea to shipped, the on-ramps that feed into it, and the vocabulary skills that run underneath. |
| [Grilling](/skills/craft/grilling) | A relentless interview that stress-tests a plan before any code exists. |
| [Guard](/skills/craft/guard) | Safety rails, in two layers. The catalogue tells the agent which commands are catastrophic, which merely warrant a warning, and which are worth noting. |
| [Handoff](/skills/craft/handoff) | Compacts the conversation into a portable document another session can pick up, written to the OS temp directory rather than the repo. |
| [Investigate](/skills/craft/investigate) | Root-cause debugging, structured so the hard part comes first. |
| [New feature](/skills/craft/new-feature) | The end-to-end build. Slice the work into tracer bullets first, each cutting a narrow but complete path through model, migration, action, route and test, then build them one at a time off the frontier. |
| [Office hours](/skills/craft/office-hours) | A product thinking partner that produces design documents and never code. |
| [Plan review](/skills/craft/plan-review) | Architecture review at two levels: are we building the right thing, and are we building it right. |
| [Prototype](/skills/craft/prototype) | Throwaway code that answers exactly one design question. Two branches: a single shareable HTML file that lets a non-developer drive a state model by clicking buttons, or several radically different stx variants of one view. |
| [Retro](/skills/craft/retro) | A retrospective that proposes changes to the environment rather than to the person. |
| [Review](/skills/craft/review) | Two-axis review of a diff. Standards asks whether the code follows this repo's rules and stays clear of the Fowler smell baseline. |
| [Security audit](/skills/craft/security-audit) | Security analysis that has to show its work. OWASP Top 10, STRIDE threat modelling, attack-surface mapping and a dependency audit, with the rule that every finding carries a concrete exploit scenario rather than a category name. |
| [TDD](/skills/craft/tdd) | The red-green discipline, as opposed to the test utilities that [Testing](/skills/toolchain/testing) documents. |
| [Wizard](/skills/craft/wizard) | For the steps only a human can take: cloud credentials, a registrar's nameservers, SES verification, CI secrets, a one-off cutover. |
| [Writing for agents](/skills/craft/writing-for-agents) | The skill for writing skills, and for every other document an agent reads. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
