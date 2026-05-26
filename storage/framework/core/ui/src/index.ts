import { ui } from '@stacksjs/config'
import * as CssEngine from '@cwcss/crosswind'

export { CssEngine, ui }

// Web-font preload + @font-face helpers — used by stx layouts to
// eliminate the FOUT/CLS that hits when a page renders with the
// fallback font and then re-flows once the web font lands
// (stacksjs/stacks#283).
export {
  renderFontFaceCss,
  renderFontHead,
  renderFontPreloads,
} from './fonts'
export type { FontEntry } from './fonts'
