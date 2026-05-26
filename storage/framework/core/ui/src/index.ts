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

// Pagination view helpers — pure functions consumed by the
// <Pagination> stx component (defaults/resources/components/Pagination.stx).
// stacksjs/stacks#1909 P5.
export {
  buildPageSequence,
  paginatorVariant,
  urlForPage,
} from './pagination'
export type { PaginatorView } from './pagination'
