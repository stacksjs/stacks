---
title: "Image generation: mobile skill"
description: "Use when designing a mobile app (onboarding, auth, home, profile, settings, chat, ecommerce, fintech, health, productivity, or social) in a Stacks context and you want premium app-native screen and flow REFERENCE IMAGES first, shown inside clean iOS/Android/cross-platform phone mockups. Generates IMAGES ONLY, never code. Prioritizes clean hierarchy, readable text, multi-screen consistency, controlled palettes, non-generic art direction, and believable flow logic a coding step can recreate."
---
# Image generation: mobile

`stacks-imagegen-mobile` · Design · model-invoked

Generates premium mobile app screens and flows as reference images, shown inside
clean iOS, Android or cross-platform phone mockups. Images only. Prioritises
readable hierarchy, multi-screen consistency and believable flow logic.

## Inside the skill

The sections an agent reads once the skill loads.

- 1. ACTIVE BASELINE CONFIGURATION
- 2. PLATFORM MODE RULE
- 3. MANDATORY SCREEN-FIRST RULE
- 4. GENERATE ENOUGH SCREENS RULE
- 5. DO NOT CROP OLD IMAGES RULE
- 6. APP DESIGN BIBLE RULE
- 7. MULTI-SCREEN CONSISTENCY RULE
- 8. LOGICAL FLOW RULE
- 9. DEFAULT MOCKUP PRESENCE RULE
- 10. DEVICE MOCKUP FRAME RULE
- 11. ONBOARDING FLOW RULE
- 12. FIRST SCREEN CLEANLINESS RULE
- 13. SAFE AREA AND SYSTEM REGION RULE
- 14. NAVIGATION RULE
- 15. CLEAN LAYOUT RULE
- 16. CREATIVE IMAGE DIRECTION RULE
- 17. BACKGROUND TEXTURE AND SURFACE RULE
- 18. IMAGE-BEHIND-TEXT RULE
- 19. CREATIVE ASSET RULE
- 20. ICONOGRAPHY RULE
- 21. MOBILE ANTI-AI-TELLS RULE
- 22. STYLE VARIATION ENGINE
- 23. COLOR PALETTE RULE
- 24. NON-GENERICITY RULE
- 25. NOT ALWAYS SIMPLE RULE
- 26. IMAGE SYSTEM RULE
- 27. FIXED MOBILE MEDIA FRAME RULE
- 28. TEXT RULE
- 29. TEXT SIZE AND READABILITY RULE
- 30. TYPOGRAPHY RULE
- 31. SPACING AND DENSITY RULE
- 32. SCREEN-TO-SCREEN VARIATION RULE
- 33. CATEGORY-SPECIFIC BIAS
- 34. REGENERATION RULE
- 35. QUALITY CHECK
- 36. RESPONSE BEHAVIOR
- 37. EXAMPLE INTERPRETATIONS
- 38. FINAL GOAL

## Related skills

- [Brand kit](/skills/design/brandkit)
- [Design taste](/skills/design/design-taste)
- [Image to code](/skills/design/image-to-code)
- [Image generation: web](/skills/design/imagegen-web)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-imagegen-mobile
```

Source: [`stacks-imagegen-mobile/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-imagegen-mobile/SKILL.md).
Shadow it for one project with `app/Skills/stacks-imagegen-mobile/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
