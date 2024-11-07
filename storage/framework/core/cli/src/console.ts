import { log } from '@stacksjs/logging'
import ansiEscapes from 'ansi-escapes'
import prompts from 'prompts'
import supportsHyperlinks from 'supports-hyperlinks'

export { log, prompts }

// thanks to https://github.com/sindresorhus/terminal-link/blob/main/index.js
// eslint-disable-next-line ts/no-unsafe-function-type
export default function terminalLink(text: string, url: string, { target = 'stdout', ...options }: { target?: string, fallback?: boolean | Function }): string {
  // @ts-expect-error - it is not properly typed
  if (!supportsHyperlinks[target]) {
    // If the fallback has been explicitly disabled, don't modify the text itself.
    if (options.fallback === false) {
      return text
    }

    return typeof options.fallback === 'function' ? options.fallback(text, url) : `${text} (\u200B${url}\u200B)`
  }

  return ansiEscapes.link(text, url)
}
