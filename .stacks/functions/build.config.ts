import { defineBuildConfig } from 'unbuild'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { createUnimport } from 'unimport'
import consola from 'consola'
import typescript from 'rollup-plugin-typescript2'
import { functionsLibrary } from '../../config/library'
import { lintFix } from '../src/scripts/lint'

export default defineBuildConfig({
  entries: ['./index'],
  outDir: './dist',
  declaration: true,
  clean: true,
  // externals: ['vue'],
  rollup: {
    emitCJS: true,
    inlineDependencies: true,
  },
  hooks: {
    'build:before': async () => {
      await copyEntryPoint()
      // we are now copying the functions to a temporary directory
      await fs.copy('../../functions', './src')
      // in order to inject the auto-imported APIs
      await injectAutoImportedApis()
      // we are now running eslint in order to ensure there are no unused injected imports
      await lintFix()
    },
    'rollup:options': (ctx, option) => {
      if (option.plugins) {
        option.plugins.push(typescript({
          verbosity: 2,
          clean: true,
          useTsconfigDeclarationDir: true,
        }))
      }

      if (functionsLibrary.shouldBuildIife) {
        // option.output?.push({
        //   name: 'index.iife.js',
        //   dir: ctx.options.outDir,
        //   format: 'iife',
        //   exports: 'auto',
        //   preferConst: true,
        //   externalLiveBindings: false,
        //   freeze: false,
        // })
      }
    },
  },
})

export async function copyEntryPoint() {
  await fs.copy('../../config/functions.ts', './index.ts')

  const raw = await fs.readFile('./index.ts', 'utf-8')
  const changed = raw.replace(/functions/g, 'functions/src')
  await fs.writeFile('./index.ts', changed, 'utf-8')
}

export async function injectAutoImportedApis(paths: string[] = ['./src/**/*.ts']) {
  const raw = await fs.readFile('../auto-imports.d.ts', 'utf-8')
  const globalNames = raw.match(/(?<=const )(.*?)(?=:)/gs) // https://regexr.com/397dr

  if (!globalNames?.length) {
    consola.error('No auto-imported APIs found in auto-imports.d.ts')
    return
  }

  const globalFroms = raw.match(/(?<=\(')(.*?)(?='\))/gs) // https://regexr.com/397dr

  if (!globalFroms?.length) {
    consola.error('No auto-imported API paths found in auto-imports.d.ts')
    return
  }

  const files = await fg(paths, {
    onlyFiles: true,
  })

  let i = 0
  for (const file of files) {
    for (const global of globalNames) {
      const raw = await fs.readFile(file, 'utf-8')

      if (raw.includes(global)) {
        // if global is found, inject auto-import
        const { injectImports } = createUnimport({
          imports: [{ name: global, from: globalFroms[i] }],
        })

        const changed = (await injectImports(raw)).code
        await fs.writeFile(file, changed, 'utf-8')
      }

      i++
    }
  }
}
