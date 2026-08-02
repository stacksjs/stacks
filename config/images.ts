import type { ImagesConfig } from '@stacksjs/types'

/**
 * **Images Configuration**
 *
 * Generated imagery — the social cards link previews show, the App Store
 * screenshot set, and the platform icon sets — is declared here and built by
 * `buddy generate:images`. Because Stacks is fully-typed, you may hover any of
 * the options below and the definitions will be provided. In case you have any
 * questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * Every generator is off until you fill it in: each one needs an asset the
 * framework cannot invent — a TrueType face, a product capture, a square
 * source icon.
 */
export default {
  // Cards and screenshots draw real glyphs rather than relying on a system
  // font stack, so a face has to be a file the project ships or depends on.
  // Point at a `.ttf`; OpenType/CFF and WOFF2 are different outline formats
  // and will not load.
  //
  // fonts: {
  //   title: '@expo-google-fonts/inter/Inter_700Bold.ttf',
  //   body: '@expo-google-fonts/inter/Inter_400Regular.ttf',
  // },

  // Shared palette. Positions are fractions of the canvas, so one definition
  // renders correctly at every size the generators produce.
  //
  // background: {
  //   color: '#0b0b0f',
  //   gradient: { angle: 165, stops: [
  //     { offset: 0, color: '#0b0b0f' },
  //     { offset: 1, color: '#14141c' },
  //   ] },
  //   glows: [{ x: 0.84, y: 0.08, radius: 0.6, color: '#6366f138' }],
  // },
  // color: '#f5f5f7',
  // accent: '#6366f1',

  social: {
    enabled: false,
    outputDir: 'public/social',
    publicPath: '/social',
    // The `og` preset is the primary card and keeps the bare filename. The
    // others exist because some consumers reserve a taller slot than 1.91:1
    // and letterbox a wide card into it.
    presets: ['og', 'square', 'portrait'],
    // pages: [
    //   { path: '/', title: 'Your headline here.', subtitle: 'One supporting line.' },
    // ],
  },

  appStore: {
    enabled: false,
    outputDir: 'resources/app-store/screenshots',
    displays: ['APP_IPHONE_67', 'APP_IPAD_PRO_3GEN_129', 'APP_DESKTOP'],
    // Each slide is one claim about the product. `capture` is a raw screenshot
    // of the app — no frame, no caption; the framing happens for you.
    // slides: [
    //   { capture: 'dist/captures/home.png', headline: 'What it does.', subheadline: 'Why that matters.' },
    // ],
  },

  appIcons: {
    enabled: false,
    // source: 'resources/icon.png',
    outputDir: 'resources/app-icons',
    platforms: ['ios', 'macos'],
    favicon: false,
    faviconDir: 'public',
  },
} satisfies ImagesConfig
