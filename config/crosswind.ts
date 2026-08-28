import type { CrosswindOptions } from '@cwcss/crosswind'

/**
 * Crosswind (utility CSS) — content globs for STX views.
 *
 * `satisfies` rather than a bare object: this was the one config file checked
 * against nothing, so a misspelled key sat here doing nothing at all. `minify`
 * in particular is read by the dev server and decides whether generated CSS is
 * whitespace-formatted, which is not something you notice by looking.
 *
 * @see https://github.com/cwcss/crosswind
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
   * No `preflight` key. There was one - `preflight: true` - and crosswind has
   * never had such an option: the real one is `preflights`, and it takes an
   * array of Preflight objects rather than a boolean. So it did nothing, in
   * both spellings, for as long as it was here.
   *
   * Nothing is lost by dropping it. The base reset ships in the `cw-base`
   * layer of the generated CSS either way, which is what the key was reaching
   * for.
   */
  minify: false,
} satisfies CrosswindOptions
