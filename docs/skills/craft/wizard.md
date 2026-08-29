---
title: "Wizard skill"
description: "Use when a procedure needs a human in the loop and the agent has hit a wall it cannot pass alone."
---
# Wizard

`stacks-wizard` · Engineering craft · model-invoked

For the steps only a human can take: cloud credentials, a registrar's
nameservers, SES verification, CI secrets, a one-off cutover. It generates an
interactive bash script that opens each URL, says exactly what to click, captures
the value, and writes it into `.env` and GitHub secrets, so the procedure stops
being something you re-explain to an agent every time.

## When to reach for it

- Provisioning cloud credentials
- Verifying a sending domain
- Setting CI secrets
- Clicking through a registrar
- Third-party dashboard
- Running a one-off cutover

## Inside the skill

The sections an agent reads once the skill loads.

- When this is the right tool
- Process

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`scripts/template.sh`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-wizard/scripts/template.sh)

## Related skills

- [Cloud](/skills/toolchain/cloud)
- [Deploy](/skills/toolchain/deploy)
- [DNS](/skills/toolchain/dns)
- [Email](/skills/messaging/email)
- [Guard](/skills/craft/guard)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-wizard
```

Source: [`stacks-wizard/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-wizard/SKILL.md).
Shadow it for one project with `app/Skills/stacks-wizard/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
