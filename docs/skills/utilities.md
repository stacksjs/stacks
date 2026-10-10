---
title: "Utilities skills"
description: "Strings, arrays, collections, objects, dates and slugs."
---
# Utilities

Strings, arrays, collections, objects, dates and slugs.

The small, dependency-free helpers. Each one is a package you can import on its
own.

10 skills.

| Skill | What it is for |
|---|---|
| [Arrays](/skills/utilities/arrays) | Statistical operations (average, median, mode, standard deviation, z-score, percentile, covariance) and array manipulation (unique, flatten, partition, shuffle, sample, move), behind the `Arr` facade. |
| [Collections](/skills/utilities/collections) | Laravel-style chainable collections over arrays: map, filter, reduce and group, wrapping `ts-collect`. |
| [DateTime](/skills/utilities/datetime) | A Carbon-like `DateTime` class: add and subtract, compare, format, start and end of day, month and year, parsing and timezones. |
| [Objects](/skills/utilities/objects) | Type-safe deep merging, object mapping, strict key checking, typed entries and keys, property picking, and clearing undefined values. |
| [Slug](/skills/utilities/slug) | URL slugs, including unique ones that check the database for collisions before returning. |
| [Strings](/skills/utilities/strings) | Case conversion in every direction, pluralization, validation helpers, slug generation, random strings and template interpolation, behind the `Str` facade. |
| [Utils](/skills/utilities/utils) | The general toolkit: deep merge, debounce and throttle, byte formatting, markdown tables, YAML parsing, the `Pipeline` class and a good deal more. |
| [Audio](/skills/utilities/audio) | planning native audio derivatives, processing supported audio formats, generating waveforms/transcripts, or signing audio delivery.. |
| [Image](/skills/utilities/image) | generating responsive image variants, selecting image formats, signing transforms, or building native social cards and app imagery.. |
| [Video](/skills/utilities/video) | planning or processing native video renditions, HLS/DASH delivery, preview tracks, signed assets, or file/range responses.. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
