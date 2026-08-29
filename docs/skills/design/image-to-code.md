---
title: "Image to code skill"
description: "Use when the deliverable is a visually important Stacks page (hero, landing page, marketing site, portfolio, product page, editorial brand page, or redesign where visual quality matters) and you want to generate design reference image(s), deeply analyze them, then implement the UI to match. Runs an image-first pipeline (generate, analyze, implement) and retargets the implement phase to stx + Crosswind + composables."
---
# Image to code

`stacks-image-to-code` · Design · model-invoked

An image-first pipeline for a visually important page: generate design reference
images, analyse them deeply, then implement to match in stx and Crosswind. Use it
when the visual bar matters more than the speed of the first draft.

## Inside the skill

The sections an agent reads once the skill loads.

- CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE
- 1. ACTIVE BASELINE CONFIGURATION
- 2. MANDATORY IMAGE-FIRST RULE
- 3. GENERATE ENOUGH IMAGES RULE
- 4. SECTION IMAGE RULE
- 5. DO NOT CROP OLD IMAGES RULE
- 6. FRESH RE-GENERATION RULE
- 7. OPTIONAL DETAIL / EXTRACTION IMAGE RULE
- 8. CLEAN ANALYSIS STANDARD
- 9. DEEP IMAGE ANALYSIS REQUIREMENT
- 10. IMAGE-FIRST WORKFLOW
- 11. WHEN TO TRIGGER IMAGE GENERATION FIRST
- 12. THE STACKS IMPLEMENTATION TARGET
- 13. WEBSITE REFERENCE RULE
- 14. HERO MINIMALISM RULES
- 15. RESPONSIVE FIRST-VIEW RULE
- 16. ANTI-NESTED-BOX RULE
- 17. REDUCE MICRO-UI CLUTTER RULE
- 18. EXTRACTION RULES (text, typography, spacing, components, color)
- 19. DESIGN-TO-CODE COPY DISCIPLINE
- 20. ANTI-DRIFT IMPLEMENTATION RULE
- 21. MISSING DETAIL RESOLUTION
- 22. ANTI-AI-SLOP RULES
- 23. SECTION RHYTHM AND SPACING DISCIPLINE
- 24. DEFAULT SECTION PACKS
- 25. MULTI-IMAGE CONSISTENCY RULE
- 26. FINAL PRE-FLIGHT CHECK
- 27. RESPONSE BEHAVIOR
- 28. FINAL GOAL

## Related skills

- [Composables](/skills/frontend/composables)
- [Crosswind](/skills/frontend/crosswind)
- [Design taste](/skills/design/design-taste)
- [Image generation: web](/skills/design/imagegen-web)
- [stx](/skills/frontend/stx)
- [UI](/skills/frontend/ui)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-image-to-code
```

Source: [`stacks-image-to-code/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-image-to-code/SKILL.md).
Shadow it for one project with `app/Skills/stacks-image-to-code/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
