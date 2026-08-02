---
title: Generated Images
description: "Social cards, App Store screenshots, and app icons, declared in config/images.ts and built with the project."
---

# Generated Images

Three kinds of imagery go stale silently, because nothing fails when they do:

- the **social card** a link preview shows, which quotes copy that keeps changing;
- the **App Store screenshots**, which describe a product that keeps shipping;
- the **app icon and favicon sets**, which grow a new required size every year.

Stacks declares all three in `config/images.ts` and builds them from the project,
so they change when the project does. Under the hood it wraps
[`ts-images`](https://github.com/stacksjs/ts-images), which composes them
directly — no headless browser, no external binary, exact pixel dimensions.

## Commands

```bash
buddy generate:images      # everything declared
buddy generate:og          # social cards only  (alias: generate:social)
buddy generate:app-store   # store screenshots  (alias: generate:screenshots)
buddy generate:app-icons   # icon + favicon sets
```

`buddy build` rebuilds the social cards and icon sets on its own, and
`buddy extension:safari:publish` rebuilds the screenshot set before uploading —
pass `--skip-screenshots` to opt out. Every generator no-ops when its section is
not `enabled`, so none of this fires on a project that has not asked for it.

## Fonts

Cards and screenshots draw real glyph outlines rather than leaning on a system
font stack, because a stack renders differently in CI than on a laptop. Point at
a TrueType file the project ships or depends on:

```ts
fonts: {
  title: '@expo-google-fonts/inter/Inter_700Bold.ttf',
  body: '@expo-google-fonts/inter/Inter_400Regular.ttf',
},
```

The value may be a project-relative path or a module specifier. OpenType/CFF
(`.otf`) and WOFF2 are different outline formats and will not load.

## Social cards

```ts
// config/images.ts
import type { ImagesConfig } from '@stacksjs/types'

export default {
  fonts: { title: '@expo-google-fonts/inter/Inter_700Bold.ttf' },

  background: {
    color: '#0b0b0f',
    gradient: { angle: 165, stops: [
      { offset: 0, color: '#0b0b0f' },
      { offset: 1, color: '#14141c' },
    ] },
    glows: [{ x: 0.84, y: 0.08, radius: 0.6, color: '#6366f138' }],
  },
  color: '#f5f5f7',
  accent: '#6366f1',

  social: {
    enabled: true,
    outputDir: 'public/social',
    publicPath: '/social',
    brand: 'Acme',
    mark: 'public/icons/icon-128.png',
    foreground: 'dist/captures/app.png',
    presets: ['og', 'square', 'portrait'],
    pages: [
      { path: '/', title: 'Everything, in one place.', subtitle: 'No account required.' },
      { path: '/pricing', title: 'Pricing that stops at fair.', eyebrow: 'Plans' },
    ],
  },
} satisfies ImagesConfig
```

Each page produces one card per preset. The `og` preset keeps the bare file name
(`og.jpg`, `pricing.jpg`) so the primary card's URL stays stable; the rest are
suffixed (`og-square.jpg`).

### Why more than one size

A scraper decides for itself what shape of slot to put your one `og:image` in.
1.91:1 is right for Facebook, LinkedIn, Slack and Discord. Apple's link previews
in Messages reserve a taller box and letterbox a wide card into it, leaving dead
space. Declaring the wide card as primary and offering the others as alternates
covers both.

### Meta tags

Generating the image is half of it — a page also has to declare what it is:

```ts
import { socialMetaTags } from '@stacksjs/image'

const tags = socialMetaTags(card, 'https://example.com')
```

which emits the primary card, its type and dimensions, an alt line, and
`twitter:card=summary_large_image`. That last one matters: the default,
`summary`, renders a small square thumbnail no matter how good the card is.

## App Store screenshots

App Store Connect takes ten screenshots per device class. Most listings ship one,
because keeping ten in step across iPhone, iPad and Mac, every release, is not
something anyone does by hand twice.

```ts
appStore: {
  enabled: true,
  outputDir: 'resources/app-store/screenshots',
  displays: ['APP_IPHONE_67', 'APP_IPAD_PRO_3GEN_129', 'APP_DESKTOP'],
  device: { radius: 0.035, borderColor: '#ffffff14' },
  slides: [
    {
      capture: 'dist/captures/home.png',
      headline: 'Everything, in one place.',
      subheadline: 'One screen for the whole account.',
    },
    {
      capture: 'dist/captures/dashboard.png',
      headline: 'Numbers you can act on.',
      // A wide capture reads poorly on a 1290x2796 phone frame, so this slide
      // is restricted to the classes it suits.
      displays: ['APP_DESKTOP', 'APP_IPAD_PRO_3GEN_129'],
    },
  ],
},
```

`capture` is a raw screenshot of the app — no frame, no caption, no bezel.
Capturing it is your app's job; the background, headline, device framing, and
resampling to Apple's exact dimensions are not.

Files are named `app-iphone-67-01.png` and numbered per device class in slide
order, so `config/extension.ts` can point at them directly:

```ts
screenshots: {
  APP_IPHONE_67: [
    'resources/app-store/screenshots/app-iphone-67-01.png',
    'resources/app-store/screenshots/app-iphone-67-02.png',
  ],
},
```

## App icons

```ts
appIcons: {
  enabled: true,
  source: 'resources/icon.png',   // square, 1024x1024 or larger
  outputDir: 'resources/app-icons',
  platforms: ['ios', 'macos'],
  favicon: true,
  faviconDir: 'public',
},
```

Produces the Xcode asset catalogs for the platforms listed and, with `favicon`,
a full favicon set including a multi-resolution `.ico`, `apple-touch-icon.png`,
and `site.webmanifest`.

## Sharing a palette

`background`, `color`, `mutedColor`, `accent`, `device`, `brand` and `mark` can
be set once at the top level and each generator inherits them. Positions inside
a background are fractions of the canvas, not pixels, so one definition renders
correctly at 1200×630, 1290×2796 and 2880×1800 — which is what lets a site and
a store listing actually look like the same product.
