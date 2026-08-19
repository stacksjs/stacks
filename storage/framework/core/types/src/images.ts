/**
 * **Images Configuration**
 *
 * Generated imagery — social cards, App Store screenshots, app icons — is
 * declared here and produced by `buddy generate:images`. The point of putting
 * it in configuration rather than a script is that these assets go stale
 * silently: a headline changes on the site and the card that quotes it does
 * not, a release adds a feature and the store listing still shows the old one.
 * Declared, they regenerate with the build.
 */

/** A colour, in any form `parseColor` reads: `#rgb`, `#rrggbbaa`, `rgb()`. */
export type ImageColor = string

export interface ImageGradientStop {
  /** Position along the gradient's axis, 0 to 1. */
  offset: number
  color: ImageColor
}

/**
 * A branded backdrop.
 *
 * Positions are fractions of the canvas rather than pixels, so one definition
 * renders correctly at 1200x630, 1290x2796 and 2880x1800 — which is what lets
 * a site's cards and an App Store listing share a single palette.
 */
export interface ImageBackgroundConfig {
  /** Flat base colour, painted first. */
  color?: ImageColor
  /** Linear wash over the base. `angle` is read as CSS reads it. */
  gradient?: { angle?: number, stops: ImageGradientStop[] }
  /** Soft coloured discs. `x`/`radius` are fractions of width, `y` of height. */
  glows?: Array<{ x: number, y: number, radius: number, color: ImageColor }>
  /** Photograph, cover-cropped to the canvas. Project-relative. */
  image?: string
}

/** How a screenshot or product shot is drawn into a composition. */
export interface ImageDeviceConfig {
  /** Corner radius as a fraction of the drawn width. @default 0.045 */
  radius?: number
  /** Hairline around the capture, so a dark shot keeps its edge. */
  borderColor?: ImageColor
  /** Shadow under the capture. Set `false` for none. */
  shadow?: false | { blur?: number, offsetX?: number, offsetY?: number, spread?: number, color?: ImageColor }
  /** Share of the canvas the capture may occupy along its governing axis. */
  scale?: number
}

/** Faces used for generated imagery. TrueType (`glyf`) outlines only. */
export interface ImageFontConfig {
  /**
   * Bold face, used for headlines and the wordmark. Project-relative path, or
   * a module specifier resolvable from the project (`@expo-google-fonts/inter/
   * Inter_700Bold.ttf`).
   *
   * CFF/OTF and WOFF2 are not TrueType outlines and will not load.
   */
  title: string
  /** Face for supporting copy. Falls back to `title`. */
  body?: string
}

export interface SocialCardPageConfig {
  /**
   * Route this card belongs to, used to name the file: `/` becomes `og`,
   * `/features/popups` becomes `features-popups`.
   */
  path: string
  title: string
  eyebrow?: string
  subtitle?: string
  /** Overrides the set-wide product shot for this page. */
  foreground?: string
}

export interface SocialCardsConfig {
  enabled?: boolean
  /** Where the cards are written. @default 'public/social' */
  outputDir?: string
  /** URL prefix the cards are served under. @default '/social' */
  publicPath?: string
  /**
   * Sizes to build. The `og` preset keeps the bare filename so the primary
   * card's URL stays stable as the set grows.
   * @default ['og', 'square', 'portrait']
   */
  presets?: Array<'og' | 'twitter' | 'square' | 'portrait'>
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  /** Wordmark drawn on every card. Defaults to `app.name`. */
  brand?: string
  /** Logo mark, drawn beside the wordmark. Project-relative image path. */
  mark?: string
  /** Plate painted behind the mark. Set `false` to draw it bare. */
  markPlate?: false | ImageColor
  /** Product shot placed opposite the copy on every card. */
  foreground?: string
  device?: ImageDeviceConfig
  background?: ImageBackgroundConfig
  color?: ImageColor
  mutedColor?: ImageColor
  accent?: ImageColor
  /** One entry per page that needs its own card. */
  pages?: SocialCardPageConfig[]
}

export type AppStoreDisplay =
  | 'APP_IPHONE_67'
  | 'APP_IPHONE_65'
  | 'APP_IPHONE_61'
  | 'APP_IPHONE_58'
  | 'APP_IPHONE_55'
  | 'APP_IPAD_PRO_3GEN_129'
  | 'APP_IPAD_PRO_3GEN_11'
  | 'APP_IPAD_PRO_129'
  | 'APP_IPAD_105'
  | 'APP_IPAD_97'
  | 'APP_DESKTOP'

export interface AppStoreSlideConfig {
  /**
   * The raw product capture this slide is built around — no frame, no caption.
   * Project-relative. Capturing it is the app's job; framing it is not.
   */
  capture: string
  headline: string
  subheadline?: string
  /**
   * Restricts the slide to these device classes. Omit to render it for every
   * class in `displays`. Use it when a capture's shape only suits some of
   * them — a wide dashboard reads poorly on a 1290x2796 phone frame.
   */
  displays?: AppStoreDisplay[]
  background?: ImageBackgroundConfig
}

export interface AppStoreScreenshotsConfig {
  enabled?: boolean
  /** @default 'resources/app-store/screenshots' */
  outputDir?: string
  /** Device classes to render. Apple accepts at most 10 slides per class. */
  displays?: AppStoreDisplay[]
  slides?: AppStoreSlideConfig[]
  /** Wordmark drawn under the copy. Defaults to `app.name`. */
  brand?: string
  mark?: string
  markPlate?: false | ImageColor
  background?: ImageBackgroundConfig
  device?: ImageDeviceConfig
  color?: ImageColor
  mutedColor?: ImageColor
  format?: 'png' | 'jpeg'
  quality?: number
  /** `auto` picks by canvas shape: beside on landscape, stacked on portrait. */
  layout?: 'auto' | 'stacked' | 'beside'
}

export interface AppIconsConfig {
  enabled?: boolean
  /** Square source image, 1024x1024 or larger. Project-relative. */
  source?: string
  /** @default 'resources/app-icons' */
  outputDir?: string
  /**
   * Platform icon sets to build. Defaults to iOS and macOS.
   *
   * An explicit `[]` means neither, which is what a web project wants: it
   * needs the favicons below and has no use for an Xcode asset catalog.
   */
  platforms?: Array<'ios' | 'macos'>
  /** Also emit a favicon set to `faviconDir`. */
  favicon?: boolean
  /** @default 'public' */
  faviconDir?: string
  /**
   * The `site.webmanifest` written beside the favicons. `false` writes none.
   *
   * Without this the manifest is generated with the renderer's placeholder
   * defaults - an app called "App", a theme colour belonging to no brand -
   * and a project has nowhere to say otherwise short of overwriting the file
   * after every build.
   */
  manifest?: false | {
    name?: string
    shortName?: string
    themeColor?: ImageColor
    backgroundColor?: ImageColor
    /** URL prefix for the icon paths, when they are not at the document root. */
    pathPrefix?: string
  }
}

export interface ImagesConfig {
  /** Faces used by every generator that draws text. */
  fonts?: ImageFontConfig
  /** Palette shared by the generators when they do not override it. */
  background?: ImageBackgroundConfig
  color?: ImageColor
  mutedColor?: ImageColor
  accent?: ImageColor
  device?: ImageDeviceConfig
  /** Wordmark and mark shared by the generators. */
  brand?: string
  mark?: string
  /**
   * Plate painted behind the mark. Set `false` to draw it bare.
   *
   * Shared alongside `mark`, because the two are one decision: a wordmark
   * that already ships white wants no plate wherever it is drawn.
   */
  markPlate?: false | ImageColor
  social?: SocialCardsConfig
  appStore?: AppStoreScreenshotsConfig
  appIcons?: AppIconsConfig
}
