/**
 * Terminal colors and formatting (kolorist replacement)
 *
 * Lightweight terminal color library with zero dependencies
 */

const isColorSupported = !process.env.NO_COLOR && (process.env.FORCE_COLOR || process.stdout?.isTTY)

const colors = {
  // Reset
  reset: isColorSupported ? '\x1B[0m' : '',

  // Text colors
  black: isColorSupported ? '\x1B[30m' : '',
  red: isColorSupported ? '\x1B[31m' : '',
  green: isColorSupported ? '\x1B[32m' : '',
  yellow: isColorSupported ? '\x1B[33m' : '',
  blue: isColorSupported ? '\x1B[34m' : '',
  magenta: isColorSupported ? '\x1B[35m' : '',
  cyan: isColorSupported ? '\x1B[36m' : '',
  white: isColorSupported ? '\x1B[37m' : '',
  gray: isColorSupported ? '\x1B[90m' : '',
  grey: isColorSupported ? '\x1B[90m' : '',

  // Bright text colors
  lightRed: isColorSupported ? '\x1B[91m' : '',
  lightGreen: isColorSupported ? '\x1B[92m' : '',
  lightYellow: isColorSupported ? '\x1B[93m' : '',
  lightBlue: isColorSupported ? '\x1B[94m' : '',
  lightMagenta: isColorSupported ? '\x1B[95m' : '',
  lightCyan: isColorSupported ? '\x1B[96m' : '',
  lightGray: isColorSupported ? '\x1B[37m' : '',
  lightGrey: isColorSupported ? '\x1B[37m' : '',

  // Background colors
  bgBlack: isColorSupported ? '\x1B[40m' : '',
  bgRed: isColorSupported ? '\x1B[41m' : '',
  bgGreen: isColorSupported ? '\x1B[42m' : '',
  bgYellow: isColorSupported ? '\x1B[43m' : '',
  bgBlue: isColorSupported ? '\x1B[44m' : '',
  bgMagenta: isColorSupported ? '\x1B[45m' : '',
  bgCyan: isColorSupported ? '\x1B[46m' : '',
  bgWhite: isColorSupported ? '\x1B[47m' : '',

  // Bright background colors
  bgLightRed: isColorSupported ? '\x1B[101m' : '',
  bgLightGreen: isColorSupported ? '\x1B[102m' : '',
  bgLightYellow: isColorSupported ? '\x1B[103m' : '',
  bgLightBlue: isColorSupported ? '\x1B[104m' : '',
  bgLightMagenta: isColorSupported ? '\x1B[105m' : '',
  bgLightCyan: isColorSupported ? '\x1B[106m' : '',

  // Text formatting
  bold: isColorSupported ? '\x1B[1m' : '',
  dim: isColorSupported ? '\x1B[2m' : '',
  italic: isColorSupported ? '\x1B[3m' : '',
  underline: isColorSupported ? '\x1B[4m' : '',
  inverse: isColorSupported ? '\x1B[7m' : '',
  hidden: isColorSupported ? '\x1B[8m' : '',
  strikethrough: isColorSupported ? '\x1B[9m' : '',
}

type ColorFn = (text: string | number) => string

function createColorFn(code: string, endCode: string = colors.reset): ColorFn {
  return (text: string | number): string => {
    if (!isColorSupported) return String(text)
    return `${code}${text}${endCode}`
  }
}

// Color functions
export const black = createColorFn(colors.black)
export const red = createColorFn(colors.red)
export const green = createColorFn(colors.green)
export const yellow = createColorFn(colors.yellow)
export const blue = createColorFn(colors.blue)
export const magenta = createColorFn(colors.magenta)
export const cyan = createColorFn(colors.cyan)
export const white = createColorFn(colors.white)
export const gray = createColorFn(colors.gray)
export const grey = gray

// Bright colors
export const lightRed = createColorFn(colors.lightRed)
export const lightGreen = createColorFn(colors.lightGreen)
export const lightYellow = createColorFn(colors.lightYellow)
export const lightBlue = createColorFn(colors.lightBlue)
export const lightMagenta = createColorFn(colors.lightMagenta)
export const lightCyan = createColorFn(colors.lightCyan)
export const lightGray = createColorFn(colors.lightGray)
export const lightGrey = lightGray

// Background colors
export const bgBlack = createColorFn(colors.bgBlack)
export const bgRed = createColorFn(colors.bgRed)
export const bgGreen = createColorFn(colors.bgGreen)
export const bgYellow = createColorFn(colors.bgYellow)
export const bgBlue = createColorFn(colors.bgBlue)
export const bgMagenta = createColorFn(colors.bgMagenta)
export const bgCyan = createColorFn(colors.bgCyan)
export const bgWhite = createColorFn(colors.bgWhite)

// Bright background colors
export const bgLightRed = createColorFn(colors.bgLightRed)
export const bgLightGreen = createColorFn(colors.bgLightGreen)
export const bgLightYellow = createColorFn(colors.bgLightYellow)
export const bgLightBlue = createColorFn(colors.bgLightBlue)
export const bgLightMagenta = createColorFn(colors.bgLightMagenta)
export const bgLightCyan = createColorFn(colors.bgLightCyan)

// Text formatting
export const bold = createColorFn(colors.bold)
export const dim = createColorFn(colors.dim)
export const italic = createColorFn(colors.italic)
export const underline = createColorFn(colors.underline)
export const inverse = createColorFn(colors.inverse)
export const hidden = createColorFn(colors.hidden)
export const strikethrough = createColorFn(colors.strikethrough)

// Reset
export const reset = createColorFn(colors.reset, '')

// Strip colors from text
export function stripColors(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[\d+m/g, '')
}

// Check if colors are supported
export function supportsColor(): boolean {
  return !!isColorSupported
}

// Default export
export default {
  black,
  red,
  green,
  yellow,
  blue,
  magenta,
  cyan,
  white,
  gray,
  grey,
  lightRed,
  lightGreen,
  lightYellow,
  lightBlue,
  lightMagenta,
  lightCyan,
  lightGray,
  lightGrey,
  bgBlack,
  bgRed,
  bgGreen,
  bgYellow,
  bgBlue,
  bgMagenta,
  bgCyan,
  bgWhite,
  bgLightRed,
  bgLightGreen,
  bgLightYellow,
  bgLightBlue,
  bgLightMagenta,
  bgLightCyan,
  bold,
  dim,
  italic,
  underline,
  inverse,
  hidden,
  strikethrough,
  reset,
  stripColors,
  supportsColor,
}
