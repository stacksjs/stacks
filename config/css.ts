import type { CssOptions } from '@stacksjs/ts-css/engine'

/**
 * ts-css (utility CSS) — content globs for STX views.
 *
 * `satisfies` rather than a bare object: this was the one config file checked
 * against nothing, so a misspelled key sat here doing nothing at all. `minify`
 * in particular is read by the dev server and decides whether generated CSS is
 * whitespace-formatted, which is not something you notice by looking.
 *
 * @see https://github.com/stacksjs/ts-css
 */
export default {
  content: [
    './resources/views/**/*.{stx,html}',
    './resources/**/*.{stx,html}',
    './storage/framework/defaults/resources/views/**/*.{stx,html}',
    './storage/framework/defaults/resources/components/**/*.{stx,html}',
    './storage/framework/core/error-handling/src/views/**/*.{stx,html}',
  ],
  /*
   * No `preflight` key. There was one - `preflight: true` - and the engine has
   * never had such an option: the real one is `preflights`, and it takes an
   * array of Preflight objects rather than a boolean. So it did nothing, in
   * both spellings, for as long as it was here.
   *
   * Nothing is lost by dropping it. The base reset ships in the `cw-base`
   * layer of the generated CSS either way, which is what the key was reaching
   * for.
   */
  minify: false,

  /*
   * Classes that only exist at runtime, so no file names them: an icon chosen
   * by a value in the database (`:class="library.icon"`), a colour built from a
   * string. The scanner reads class attributes, string literals in code and an
   * `i-...` icon named by any component prop (`<EmptyState icon="i-...">`), but
   * it cannot read a value it never sees. List those here and they are always
   * generated. Names only: patterns are not supported.
   */
  // safelist: ['i-hugeicons-note-01', 'i-hugeicons-folder-02'],
} satisfies CssOptions
