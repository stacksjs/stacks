import fs from 'node:fs'
import p from 'node:path'
import path from 'node:path'
import type { BunPlugin } from 'bun'
import { isolatedDeclaration } from 'oxc-transform'

export interface DtsOptions {
  cwd?: string
  root?: string
  include?: string[]
}

export async function generate(entryPoints: string | string[], options?: DtsOptions): Promise<void> {
  let errs = ''
  const start = performance.now()
  let count = 0

  for await (const file of new Bun.Glob('packages/*/src/**/*.ts').scan()) {
    const ts = fs.readFileSync(file, 'utf-8')
    const dts = isolatedDeclaration(file, ts, { sourcemap: false })

    if (dts.errors.length) {
      dts.errors.forEach((err) => {
        // temporary workaround for https://github.com/oxc-project/oxc/issues/5668
        if (!err.includes('set value(_: S)')) {
          console.error(err)
        }
        errs += `${err}\n`
      })
    }

    const code = dts.code

    write(path.join('temp', file.replace(/\.ts$/, '.d.ts')), code)
    count++
  }

  console.log(`\n${count} isolated dts files generated in ${(performance.now() - start).toFixed(2)}ms.`)

  if (errs) {
    write(path.join('temp', 'oxc-iso-decl-errors.txt'), errs)
  }

  console.log('bundling dts with rollup-plugin-dts...')

  // bundle with rollup-plugin-dts
  // const rollupConfigs = (await import('../rollup.dts.config.js')).default

  // await Promise.all(
  //   rollupConfigs.map(c =>
  //     rollup(c).then(bundle => {
  //       return bundle.write(c.output).then(() => {
  //         console.log(picocolors.gray('built: ') + picocolors.blue(c.output.file))
  //       })
  //     }),
  //   ),
  // )

  console.log(`bundled dts generated in ${(performance.now() - start).toFixed(2)}ms.`)

  // } catch (error) {
  //   console.error('Error generating types:', error)
  //   throw error
  // }
}

function write(file: string, content: string) {
  const dir = p.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, content)
}

export function dts(options?: DtsOptions): BunPlugin {
  return {
    name: 'bun-plugin-dts-auto',

    async setup(build) {
      const entrypoints = [...build.config.entrypoints].sort()
      const root = options?.root ?? build.config.root ?? 'src'

      // generate dts here
    },
  }
}

export default dts
