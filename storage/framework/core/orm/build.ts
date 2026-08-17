import { dts } from 'bun-plugin-dtsx'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await rm('./dist', { recursive: true, force: true })

const result = await Bun.build({
  // `routes` is an entrypoint of its own so an installed app can reach it:
  // the vendored `storage/framework/orm/routes.ts` re-exports
  // `@stacksjs/orm/routes`, and without this there is nothing behind that
  // specifier — which is why every npm-installed app logged "model useApi
  // endpoints are unavailable" and served none of them.
  entrypoints: ['./src/index.ts', './src/routes.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  external: frameworkExternal(),
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
      exclude: ['tests/**'],
    }),
  ],
})

/**
 * Ship the model definitions the declarations point at.
 *
 * `src/index.ts` types every model off its definition file:
 *
 *   export const Post = lazyModel<typeof import('../../../defaults/app/Models/Content/Post').default>('Post')
 *
 * That specifier is correct inside this monorepo and NONSENSE once published.
 * From `node_modules/@stacksjs/orm/dist/` it climbs out of the package
 * entirely, resolves to nothing, and TypeScript silently falls back to `any`
 * - so an installed app got `any` for all 101 models and no error to explain
 * why. `Post.where(...)` returning `any` is how a typo in a column name ships.
 *
 * So the definitions are copied in beside the declarations and the specifiers
 * rewritten to point at the copy. They stay `.ts` on purpose: they are read
 * for their types only (`typeof import(...)`), never executed, and the
 * `defineModel` call in each one IS the type.
 */
const MODELS_SOURCE = '../../defaults/app/Models'
const MODELS_DIST = './dist/models'

await cp(MODELS_SOURCE, MODELS_DIST, { recursive: true })

// What the models import from OUTSIDE their own directory has to come along,
// or the copy resolves no better than the path it replaced. Today that is one
// file - `User` reads the password-length constants from it - and the build
// fails loudly rather than silently shipping a broken reference if a model
// ever reaches for a sibling that is not listed here.
const MODEL_SIBLINGS = ['password-policy.ts']

for (const sibling of MODEL_SIBLINGS)
  await cp(`../../defaults/app/${sibling}`, `./dist/${sibling}`)

const escaping = new Set<string>()
const glob = new Bun.Glob('**/*.ts')

for await (const entry of glob.scan(MODELS_DIST)) {
  const source = await readFile(`${MODELS_DIST}/${entry}`, 'utf8')
  for (const match of source.matchAll(/from '(\.\.\/[^']*)'/g)) {
    const target = `${match[1]!.replace(/^\.\.\//, '')}.ts`
    if (!MODEL_SIBLINGS.includes(target))
      escaping.add(`${entry}: ${match[1]}`)
  }
}

if (escaping.size) {
  throw new Error(
    `Model definitions import files that are not published with them:\n  ${[...escaping].join('\n  ')}\n`
    + 'Add them to MODEL_SIBLINGS in core/orm/build.ts, or the published types resolve to `any`.',
  )
}

for (const declaration of ['./dist/index.d.ts', './dist/routes.d.ts']) {
  const file = Bun.file(declaration)
  if (!(await file.exists()))
    continue

  const source = await readFile(declaration, 'utf8')
  const rewritten = source.replaceAll('../../../defaults/app/Models/', './models/')

  if (rewritten !== source)
    await writeFile(declaration, rewritten)
}

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
