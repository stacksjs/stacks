---
name: stacks-image
description: Use when generating responsive image variants, selecting image formats, signing transforms, or building native social cards and app imagery. Covers @stacksjs/image and its delivery/generation APIs.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Native image delivery and generation

Use image(source, options) for native responsive variants. This processes image
bytes; it is separate from AI-generated image references or marketing strategy.

## Responsive variants

The builder supports widths, formats, named presets, original inclusion and
generation. Source roots and authorization constrain source access; never join
an untrusted path outside the configured root. Content-addressed variants and
codec-version keys support caching without silently reusing obsolete encodings.
Output can publish through a storage adapter with actual metadata/public URLs.

negotiateImageVariant respects accepted formats and q-values. Use
imageResponseHeaders for delivery and signImageTransform/verifyImageTransform
for protected transforms. Signing access is not the same as model ownership.
Check installed encoders/format support rather than promising every codec works.

## Generated assets

The generate, social, app-store, app-icons, fonts and theme modules provide
native cards, store imagery, icon and screenshot-related assets. Read their
exact exports through the source catalog before choosing an entrypoint.
Use real product copy/assets and keep private data out of public render output.
STX uses img and the asset pipeline, not a framework-specific React image wrapper.

Test no-upscale behavior, requested formats, source authorization, negotiated
responses, signed access and storage publication. Source: core/image/src/index.ts
and its generation modules. Evidence: image.test.ts and generate.test.ts.
