/**
 * QR Code generation utilities
 *
 * Note: For full QR code support, install a QR code library like 'qrcode'
 * These are stub implementations that provide the interface without external dependencies
 */

/**
 * Error correction levels for QR codes
 */
export enum QRErrorCorrection {
  /** Low - recovers ~7% of data */
  L = 1,
  /** Medium - recovers ~15% of data */
  M = 0,
  /** Quartile - recovers ~25% of data */
  Q = 3,
  /** High - recovers ~30% of data */
  H = 2,
}

export interface QRCodeOptions {
  /** The text or data to encode in the QR code */
  text: string
  /** Width in pixels (default: 256) */
  width?: number
  /** Height in pixels (default: 256) */
  height?: number
  /** Dark color (default: #000000) */
  colorDark?: string
  /** Light color (default: #ffffff) */
  colorLight?: string
  /** Error correction level (default: H) */
  correctLevel?: QRErrorCorrection
  /** Use SVG rendering instead of Canvas (default: false) */
  useSVG?: boolean
}

/**
 * Generate a QR code as an SVG string
 *
 * This is a placeholder - install 'qrcode' for full support
 */
export function generateQRCodeSVG(options: QRCodeOptions): string {
  const { text, width = 256, height = 256 } = options

  // Return a placeholder SVG that indicates a QR code should be here
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="white"/>
    <rect x="10%" y="10%" width="80%" height="80%" fill="none" stroke="#ccc" stroke-width="2" stroke-dasharray="5,5"/>
    <text x="50%" y="45%" text-anchor="middle" font-family="monospace" font-size="12" fill="#666">QR Code</text>
    <text x="50%" y="55%" text-anchor="middle" font-family="monospace" font-size="8" fill="#999">${text.substring(0, 30)}${text.length > 30 ? '...' : ''}</text>
  </svg>`
}

/**
 * Generate a QR code as a data URL
 *
 * Tries to use the 'qrcode' npm package if available
 */
export async function generateQRCodeDataURL(options: QRCodeOptions): Promise<string> {
  const { text, width = 256, correctLevel = QRErrorCorrection.M } = options

  try {
    // Try to use the qrcode package if available
    const qrcode = await import('qrcode')
    const errorCorrectionMap: Record<QRErrorCorrection, 'L' | 'M' | 'Q' | 'H'> = {
      [QRErrorCorrection.L]: 'L',
      [QRErrorCorrection.M]: 'M',
      [QRErrorCorrection.Q]: 'Q',
      [QRErrorCorrection.H]: 'H',
    }
    return await qrcode.toDataURL(text, {
      width,
      margin: 2,
      errorCorrectionLevel: errorCorrectionMap[correctLevel],
    })
  } catch {
    // Fallback: return a placeholder SVG as data URL
    const svg = generateQRCodeSVG(options)
    const base64 = Buffer.from(svg).toString('base64')
    return `data:image/svg+xml;base64,${base64}`
  }
}

/**
 * Create a QR code instance (browser-only stub)
 */
export function createQRCode(
  _element: string | HTMLElement,
  _options: QRCodeOptions
): { makeCode: (text: string) => void } {
  console.warn('createQRCode requires a browser environment with a QR code library')
  return {
    makeCode: () => {
      console.warn('QR code makeCode called but no QR library available')
    }
  }
}
