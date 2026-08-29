---
title: "Image generation: web skill"
description: "Use when designing a landing page, portfolio, hero, or marketing site in a Stacks app and you want premium website design REFERENCE IMAGES first (one horizontal image per section."
---
# Image generation: web

`stacks-imagegen-web` · Design · model-invoked

Generates premium website reference images and nothing else, one horizontal frame
per section. It enforces composition variety, varied CTAs and hero scales, a
narrative spine and one consistent palette across every frame, so a coding step
can actually recreate them.

## When to reach for it

- Hero
- Trust bar
- Features
- Pricing
- CTA
- etc.)

## Inside the skill

The sections an agent reads once the skill loads.

- 1. ACTIVE BASELINE CONFIGURATION
- 2. THE COMBINATORIAL VARIATION ENGINE
- 3. FRONTEND REFERENCE RULE
- 4. HERO MINIMALISM RULES
- 5. IMAGE COUNT & PAGE SLICING
- 6. CREATIVITY ESCALATION RULE
- 7. IMAGE-FIRST ART DIRECTION
- 8. ANTI-AI-SLOP RULES
- 9. TYPOGRAPHY-FIRST DISCIPLINE
- 10. SECTION RHYTHM RULE
- 11. COMPONENT EXECUTION GUIDELINES
- 12. DENSITY & SPACING DISCIPLINE
- 13. COLOR & MATERIAL RULES
- 14. IMAGE / MEDIA DIRECTION
- 15. DEFAULT SITE PACKS
- 16. MULTI-IMAGE CONSISTENCY RULE
- 17. CLARITY CHECK
- 18. EXTRA CREATIVITY & IMPLEMENTATION EDGE
- 19. RESPONSE BEHAVIOR
- 20. EXAMPLE INTERPRETATIONS
- 21. FINAL GOAL

## Related skills

- [Brand kit](/skills/design/brandkit)
- [Design taste](/skills/design/design-taste)
- [Image to code](/skills/design/image-to-code)
- [Image generation: mobile](/skills/design/imagegen-mobile)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-imagegen-web
```

Source: [`stacks-imagegen-web/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-imagegen-web/SKILL.md).
Shadow it for one project with `app/Skills/stacks-imagegen-web/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
