import { collect } from '@stacksjs/collections'

type ColorInput = string | number
type ColorFn = (_text: ColorInput) => string
type ColorLike = ColorFn | string
type Alignment = 'left' | 'center' | 'right'

interface AlignOptions {
  width?: number
  align?: Alignment
  padChar?: string
}

interface BoxOptions {
  align?: Alignment
  borderColor?: ColorLike
  borderStyle?: 'single' | 'double' | 'round'
  margin?: number
  padding?: number
  title?: string
}

type NamedColorMap = {
  black: ColorFn
  red: ColorFn
  green: ColorFn
  yellow: ColorFn
  blue: ColorFn
  magenta: ColorFn
  cyan: ColorFn
  white: ColorFn
  gray: ColorFn

  lightRed: ColorFn
  lightGreen: ColorFn
  lightYellow: ColorFn
  lightBlue: ColorFn
  lightMagenta: ColorFn
  lightCyan: ColorFn
  lightGray: ColorFn

  bgBlack: ColorFn
  bgRed: ColorFn
  bgGreen: ColorFn
  bgYellow: ColorFn
  bgBlue: ColorFn
  bgMagenta: ColorFn
  bgCyan: ColorFn
  bgWhite: ColorFn
  bgGray: ColorFn

  bgLightRed: ColorFn
  bgLightGreen: ColorFn
  bgLightYellow: ColorFn
  bgLightBlue: ColorFn
  bgLightMagenta: ColorFn
  bgLightCyan: ColorFn
  bgLightGray: ColorFn

  bold: ColorFn
  dim: ColorFn
  italic: ColorFn
  underline: ColorFn
  inverse: ColorFn
  hidden: ColorFn
  strikethrough: ColorFn
  reset: ColorFn
}

const ansiSupport = !process.env.NO_COLOR && (process.env.FORCE_COLOR ? process.env.FORCE_COLOR !== '0' : !!process.stdout?.isTTY)

const ansi = {
  reset: ansiSupport ? '\x1B[0m' : '',

  black: ansiSupport ? '\x1B[30m' : '',
  red: ansiSupport ? '\x1B[31m' : '',
  green: ansiSupport ? '\x1B[32m' : '',
  yellow: ansiSupport ? '\x1B[33m' : '',
  blue: ansiSupport ? '\x1B[34m' : '',
  magenta: ansiSupport ? '\x1B[35m' : '',
  cyan: ansiSupport ? '\x1B[36m' : '',
  white: ansiSupport ? '\x1B[37m' : '',
  gray: ansiSupport ? '\x1B[90m' : '',

  lightRed: ansiSupport ? '\x1B[91m' : '',
  lightGreen: ansiSupport ? '\x1B[92m' : '',
  lightYellow: ansiSupport ? '\x1B[93m' : '',
  lightBlue: ansiSupport ? '\x1B[94m' : '',
  lightMagenta: ansiSupport ? '\x1B[95m' : '',
  lightCyan: ansiSupport ? '\x1B[96m' : '',
  lightGray: ansiSupport ? '\x1B[37m' : '',

  bgBlack: ansiSupport ? '\x1B[40m' : '',
  bgRed: ansiSupport ? '\x1B[41m' : '',
  bgGreen: ansiSupport ? '\x1B[42m' : '',
  bgYellow: ansiSupport ? '\x1B[43m' : '',
  bgBlue: ansiSupport ? '\x1B[44m' : '',
  bgMagenta: ansiSupport ? '\x1B[45m' : '',
  bgCyan: ansiSupport ? '\x1B[46m' : '',
  bgWhite: ansiSupport ? '\x1B[47m' : '',
  bgGray: ansiSupport ? '\x1B[100m' : '',

  bgLightRed: ansiSupport ? '\x1B[101m' : '',
  bgLightGreen: ansiSupport ? '\x1B[102m' : '',
  bgLightYellow: ansiSupport ? '\x1B[103m' : '',
  bgLightBlue: ansiSupport ? '\x1B[104m' : '',
  bgLightMagenta: ansiSupport ? '\x1B[105m' : '',
  bgLightCyan: ansiSupport ? '\x1B[106m' : '',
  bgLightGray: ansiSupport ? '\x1B[47m' : '',

  bold: ansiSupport ? '\x1B[1m' : '',
  dim: ansiSupport ? '\x1B[2m' : '',
  italic: ansiSupport ? '\x1B[3m' : '',
  underline: ansiSupport ? '\x1B[4m' : '',
  inverse: ansiSupport ? '\x1B[7m' : '',
  hidden: ansiSupport ? '\x1B[8m' : '',
  strikethrough: ansiSupport ? '\x1B[9m' : '',
}

const ansiCsi = '\x1B['
const hyperlinkOpen = '\x1B]8;;'
const hyperlinkClose = '\x1B]8;;\x07'
const passthrough: ColorFn = text => String(text)

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max)
}

function color(openCode: string, closeCode: string = ansi.reset): ColorFn {
  return (text: ColorInput): string => {
    if (!ansiSupport)
      return String(text)

    return `${openCode}${String(text)}${closeCode}`
  }
}

function stripHyperlinks(text: string): string {
  return text.replace(/\x1B\]8;;[^\x07]*(?:\x07|\x1B\\)/g, '').replace(/\x1B\]8;;(?:\x07|\x1B\\)/g, '')
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return stripHyperlinks(text).replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
}

export const stripColors: typeof stripAnsi = stripAnsi

function visibleWidth(text: string): number {
  return Array.from(stripAnsi(text)).length
}

export const black: ColorFn = color(ansi.black)
export const red: ColorFn = color(ansi.red)
export const green: ColorFn = color(ansi.green)
export const yellow: ColorFn = color(ansi.yellow)
export const blue: ColorFn = color(ansi.blue)
export const magenta: ColorFn = color(ansi.magenta)
export const cyan: ColorFn = color(ansi.cyan)
export const white: ColorFn = color(ansi.white)
export const gray: ColorFn = color(ansi.gray)

export const lightRed: ColorFn = color(ansi.lightRed)
export const lightGreen: ColorFn = color(ansi.lightGreen)
export const lightYellow: ColorFn = color(ansi.lightYellow)
export const lightBlue: ColorFn = color(ansi.lightBlue)
export const lightMagenta: ColorFn = color(ansi.lightMagenta)
export const lightCyan: ColorFn = color(ansi.lightCyan)
export const lightGray: ColorFn = color(ansi.lightGray)

export const bgBlack: ColorFn = color(ansi.bgBlack)
export const bgRed: ColorFn = color(ansi.bgRed)
export const bgGreen: ColorFn = color(ansi.bgGreen)
export const bgYellow: ColorFn = color(ansi.bgYellow)
export const bgBlue: ColorFn = color(ansi.bgBlue)
export const bgMagenta: ColorFn = color(ansi.bgMagenta)
export const bgCyan: ColorFn = color(ansi.bgCyan)
export const bgWhite: ColorFn = color(ansi.bgWhite)
export const bgGray: ColorFn = color(ansi.bgGray)

export const bgLightRed: ColorFn = color(ansi.bgLightRed)
export const bgLightGreen: ColorFn = color(ansi.bgLightGreen)
export const bgLightYellow: ColorFn = color(ansi.bgLightYellow)
export const bgLightBlue: ColorFn = color(ansi.bgLightBlue)
export const bgLightMagenta: ColorFn = color(ansi.bgLightMagenta)
export const bgLightCyan: ColorFn = color(ansi.bgLightCyan)
export const bgLightGray: ColorFn = color(ansi.bgLightGray)

export const bold: ColorFn = color(ansi.bold)
export const dim: ColorFn = color(ansi.dim)
export const italic: ColorFn = color(ansi.italic)
export const underline: ColorFn = color(ansi.underline)
export const inverse: ColorFn = color(ansi.inverse)
export const hidden: ColorFn = color(ansi.hidden)
export const strikethrough: ColorFn = color(ansi.strikethrough)
export const reset: ColorFn = color(ansi.reset, '')

export function ansi256(code: number): ColorFn {
  return color(`${ansiCsi}38;5;${clamp(code, 0, 255)}m`)
}

export function ansi256Bg(code: number): ColorFn {
  return color(`${ansiCsi}48;5;${clamp(code, 0, 255)}m`)
}

export function trueColor(r: number, g: number, b: number): ColorFn {
  return color(`${ansiCsi}38;2;${clamp(r, 0, 255)};${clamp(g, 0, 255)};${clamp(b, 0, 255)}m`)
}

export function trueColorBg(r: number, g: number, b: number): ColorFn {
  return color(`${ansiCsi}48;2;${clamp(r, 0, 255)};${clamp(g, 0, 255)};${clamp(b, 0, 255)}m`)
}

export function link(url: string): ColorFn
export function link(text: ColorInput, url: string): string
export function link(textOrUrl: ColorInput, maybeUrl?: string): string | ColorFn {
  const createLink = (text: ColorInput, url: string): string => {
    const value = String(text)
    if (!ansiSupport)
      return value

    return `${hyperlinkOpen}${url}\x07${value}${hyperlinkClose}`
  }

  if (typeof maybeUrl === 'string')
    return createLink(textOrUrl, maybeUrl)

  const url = String(textOrUrl)
  return (text: ColorInput) => createLink(text, url)
}

const namedColors: NamedColorMap = {
  black: black,
  red: red,
  green: green,
  yellow: yellow,
  blue: blue,
  magenta: magenta,
  cyan: cyan,
  white: white,
  gray: gray,
  lightRed: lightRed,
  lightGreen: lightGreen,
  lightYellow: lightYellow,
  lightBlue: lightBlue,
  lightMagenta: lightMagenta,
  lightCyan: lightCyan,
  lightGray: lightGray,
  bgBlack: bgBlack,
  bgRed: bgRed,
  bgGreen: bgGreen,
  bgYellow: bgYellow,
  bgBlue: bgBlue,
  bgMagenta: bgMagenta,
  bgCyan: bgCyan,
  bgWhite: bgWhite,
  bgGray: bgGray,
  bgLightRed: bgLightRed,
  bgLightGreen: bgLightGreen,
  bgLightYellow: bgLightYellow,
  bgLightBlue: bgLightBlue,
  bgLightMagenta: bgLightMagenta,
  bgLightCyan: bgLightCyan,
  bgLightGray: bgLightGray,
  bold: bold,
  dim: dim,
  italic: italic,
  underline: underline,
  inverse: inverse,
  hidden: hidden,
  strikethrough: strikethrough,
  reset: reset,
}

export function getColor(colorName: string): ColorFn {
  return namedColors[colorName as keyof typeof namedColors] ?? passthrough
}

export function colorize(text: ColorInput, colorOrFn: ColorLike): string {
  if (typeof colorOrFn === 'function')
    return colorOrFn(text)

  return getColor(colorOrFn)(text)
}

type ColorsApi = NamedColorMap & {
  ansi256: typeof ansi256
  ansi256Bg: typeof ansi256Bg
  trueColor: typeof trueColor
  trueColorBg: typeof trueColorBg
  link: typeof link
  stripColors: typeof stripColors
}

type KoloristApi = ColorsApi & {
  grey: ColorFn
  lightGrey: ColorFn
  bgLightGrey: ColorFn
  supportsColor: () => boolean
}

function supportsColor(): boolean {
  return ansiSupport
}

export const colors: ColorsApi = {
  black: black,
  red: red,
  green: green,
  yellow: yellow,
  blue: blue,
  magenta: magenta,
  cyan: cyan,
  white: white,
  gray: gray,
  lightRed: lightRed,
  lightGreen: lightGreen,
  lightYellow: lightYellow,
  lightBlue: lightBlue,
  lightMagenta: lightMagenta,
  lightCyan: lightCyan,
  lightGray: lightGray,
  bgBlack: bgBlack,
  bgRed: bgRed,
  bgGreen: bgGreen,
  bgYellow: bgYellow,
  bgBlue: bgBlue,
  bgMagenta: bgMagenta,
  bgCyan: bgCyan,
  bgWhite: bgWhite,
  bgGray: bgGray,
  bgLightRed: bgLightRed,
  bgLightGreen: bgLightGreen,
  bgLightYellow: bgLightYellow,
  bgLightBlue: bgLightBlue,
  bgLightMagenta: bgLightMagenta,
  bgLightCyan: bgLightCyan,
  bgLightGray: bgLightGray,
  bold: bold,
  dim: dim,
  italic: italic,
  underline: underline,
  inverse: inverse,
  hidden: hidden,
  strikethrough: strikethrough,
  reset: reset,
  ansi256: ansi256,
  ansi256Bg: ansi256Bg,
  trueColor: trueColor,
  trueColorBg: trueColorBg,
  link: link,
  stripColors: stripColors,
}

export const kolorist: KoloristApi = {
  black: black,
  red: red,
  green: green,
  yellow: yellow,
  blue: blue,
  magenta: magenta,
  cyan: cyan,
  white: white,
  gray: gray,
  lightRed: lightRed,
  lightGreen: lightGreen,
  lightYellow: lightYellow,
  lightBlue: lightBlue,
  lightMagenta: lightMagenta,
  lightCyan: lightCyan,
  lightGray: lightGray,
  bgBlack: bgBlack,
  bgRed: bgRed,
  bgGreen: bgGreen,
  bgYellow: bgYellow,
  bgBlue: bgBlue,
  bgMagenta: bgMagenta,
  bgCyan: bgCyan,
  bgWhite: bgWhite,
  bgGray: bgGray,
  bgLightRed: bgLightRed,
  bgLightGreen: bgLightGreen,
  bgLightYellow: bgLightYellow,
  bgLightBlue: bgLightBlue,
  bgLightMagenta: bgLightMagenta,
  bgLightCyan: bgLightCyan,
  bgLightGray: bgLightGray,
  bold: bold,
  dim: dim,
  italic: italic,
  underline: underline,
  inverse: inverse,
  hidden: hidden,
  strikethrough: strikethrough,
  reset: reset,
  ansi256: ansi256,
  ansi256Bg: ansi256Bg,
  trueColor: trueColor,
  trueColorBg: trueColorBg,
  link: link,
  stripColors: stripColors,
  grey: gray,
  lightGrey: lightGray,
  bgLightGrey: bgLightGray,
  supportsColor: supportsColor,
}

function padLine(text: string, width: number, alignMode: Alignment, padChar: string): string {
  const printableWidth = visibleWidth(text)
  if (printableWidth >= width)
    return text

  const char = padChar[0] || ' '
  const diff = width - printableWidth

  if (alignMode === 'right')
    return `${char.repeat(diff)}${text}`

  if (alignMode === 'center') {
    const left = Math.floor(diff / 2)
    const right = diff - left
    return `${char.repeat(left)}${text}${char.repeat(right)}`
  }

  return `${text}${char.repeat(diff)}`
}

function normalizedWidth(lines: string[]): number {
  return Math.max(0, ...lines.map(visibleWidth))
}

export function align(text: string, width?: number, alignMode?: Alignment): string
export function align(text: string, options?: AlignOptions): string
export function align(text: string, widthOrOptions?: number | AlignOptions, alignMode: Alignment = 'left'): string {
  const lines = String(text).split(/\r?\n/)
  const options = typeof widthOrOptions === 'object' ? widthOrOptions : undefined

  const width = typeof widthOrOptions === 'number'
    ? widthOrOptions
    : options?.width ?? normalizedWidth(lines)

  const alignment = options?.align ?? alignMode
  const padChar = options?.padChar ?? ' '

  return lines.map(line => padLine(line, Math.max(0, width), alignment, padChar)).join('\n')
}

export function leftAlign(text: string, width?: number): string {
  return align(text, width, 'left')
}

export function rightAlign(text: string, width?: number): string {
  const lines = String(text).split(/\r?\n/)
  return align(text, width ?? process.stdout?.columns ?? normalizedWidth(lines), 'right')
}

export function centerAlign(text: string, width?: number): string {
  const lines = String(text).split(/\r?\n/)
  return align(text, width ?? process.stdout?.columns ?? normalizedWidth(lines), 'center')
}

const boxStyles = {
  single: { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', horizontal: '─', vertical: '│' },
  double: { topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝', horizontal: '═', vertical: '║' },
  round: { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', horizontal: '─', vertical: '│' },
} as const

export function box(text: string, options: BoxOptions = {}): string {
  const lines = String(text).split(/\r?\n/)
  const style = boxStyles[options.borderStyle ?? 'single']
  const padding = Math.max(0, options.padding ?? 1)
  const margin = Math.max(0, options.margin ?? 0)
  const contentAlign = options.align ?? 'left'
  const contentWidth = normalizedWidth(lines)
  const innerWidth = contentWidth + (padding * 2)

  const borderColor = typeof options.borderColor === 'function'
    ? options.borderColor
    : options.borderColor
      ? getColor(options.borderColor)
      : passthrough

  const buildTopBorder = (): string => {
    if (!options.title)
      return `${style.topLeft}${style.horizontal.repeat(innerWidth)}${style.topRight}`

    const rawTitle = ` ${stripAnsi(String(options.title))} `
    const title = rawTitle.slice(0, innerWidth)
    const remainder = style.horizontal.repeat(Math.max(0, innerWidth - title.length))
    return `${style.topLeft}${title}${remainder}${style.topRight}`
  }

  const top = borderColor(buildTopBorder())
  const bottom = borderColor(`${style.bottomLeft}${style.horizontal.repeat(innerWidth)}${style.bottomRight}`)

  const body = lines.map((line) => {
    const aligned = align(line, { align: contentAlign, width: contentWidth })
    const middle = `${' '.repeat(padding)}${aligned}${' '.repeat(padding)}`
    return `${borderColor(style.vertical)}${middle}${borderColor(style.vertical)}`
  })

  const indent = ' '.repeat(margin)
  return [top, ...body, bottom].map(line => `${indent}${line}`).join('\n')
}

export const quotes: any = collect([
  // could be queried from any API or database
  'The best way to get started is to quit talking and begin doing.',
  'The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.',
  'Don’t let yesterday take up too much of today.',
  'You learn more from failure than from success. Don’t let it stop you. Failure builds character.',
  'It’s not whether you get knocked down, it’s whether you get up.',
  'If you are working on something that you really care about, you don’t have to be pushed. The vision pulls you.',
  'People who are crazy enough to think they can change the world, are the ones who do.',
  'Failure will never overtake me if my determination to succeed is strong enough.',
  'Entrepreneurs are great at dealing with uncertainty and also very good at minimizing risk. That’s the classic entrepreneur.',
  'We may encounter many defeats but we must not be defeated.',
  'Knowing is not enough; we must apply. Wishing is not enough; we must do.',
  'Imagine your life is perfect in every respect; what would it look like?',
  'We generate fears while we sit. We overcome them by action.',
  'Whether you think you can or think you can’t, you’re right.',
  'Security is mostly a superstition. Life is either a daring adventure or nothing.',
])
