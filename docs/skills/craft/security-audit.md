---
title: "Security audit skill"
description: "Use when performing security analysis on a Stacks application."
---
# Security audit

`stacks-security-audit` · Engineering craft · model-invoked

Security analysis that has to show its work. OWASP Top 10, STRIDE threat
modelling, attack-surface mapping and a dependency audit, with the rule that
every finding carries a concrete exploit scenario rather than a category name.

## When to reach for it

- OWASP Top 10
- STRIDE threat modeling
- Attack surface mapping
- Dependency audit

## Inside the skill

The sections an agent reads once the skill loads.

- Determine Scope
- Step 1: Attack Surface Map
- Attack Surface
- Step 2: OWASP Top 10
- Step 3: STRIDE Threat Model
- Step 4: Dependency Audit
- Output Format
- Attack Surface
- Critical Findings (Confidence ≥ 8/10)
- STRIDE Assessment
- Dependency Audit
- Lower Confidence Observations
- Summary
- Rules

## Related skills

- [Review](/skills/craft/review)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-security-audit
```

Source: [`stacks-security-audit/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-security-audit/SKILL.md).
Shadow it for one project with `app/Skills/stacks-security-audit/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
