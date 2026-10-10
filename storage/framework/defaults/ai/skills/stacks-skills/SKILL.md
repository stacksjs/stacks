---
name: stacks-skills
description: Use when discovering, validating, overriding, or distributing Stacks agent skills. Covers @stacksjs/skills, app/Skills, bundled defaults and buddy setup:ai.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native skill discovery

listSkills returns sorted unique names. resolveSkillPath and getSkill resolve
app/Skills before storage/framework/defaults/ai/skills. A same-name app skill
shadows the framework definition; it is not a second copy in the result.

getSkill returns metadata, instructions, source path and supporting directory
entries. validateSkill checks name/description requirements, name spelling,
lengths and folder-name agreement. It is not a full YAML parser or a semantic
proof that every referenced API exists. Use loadSkillMetadata for discovery
without inventing a separate registry of names.

buddy setup:ai materializes the merged set for the selected agent, using
per-skill symlinks or copies. Preserve shared references inside skill directories
so copy mode still works. Do not overwrite authored AGENTS.md or a real CLAUDE.md
merely to refresh generated files. Future app installs receive bundled skills
through @stacksjs/defaults and managed scaffold sync.

Read stacks-writing-for-agents before authoring instructions. New native
packages need a skill or an explicit mapping in docs:native-skills. Keep the
documentation page, sidebar, source notice when imported, and supporting files
together. Test runtime discovery and fresh-app distribution, not only filenames.

Source: core/skills/src/skills.ts and core/buddy/src/commands/setup-ai.ts.
Evidence: skills.test.ts, setup-ai.test.ts and the docs/distribution contracts.
