import fs from 'node:fs'
import p from 'node:path'
import process from 'node:process'
import type { BunPlugin } from 'bun'
import ts from 'typescript'

export interface TsOptions {
  rootDir: string
  base: string
  declaration: boolean
  emitDeclarationOnly: boolean
  noEmit: boolean
  declarationMap?: boolean
  outDir?: ts.CompilerOptions['outDir']
  [index: string]: any
}

export interface DtsOptions {
  /**
   * The base directory of the source files. If not provided, it
   * will use the current working directory of the process.
   * @default process.cwd()
   */
  base?: string

  /**
   * The TypeScript compiler options. If not provided, it will use
   * the `tsconfig.json` file in the current working directory.
   */
  compiler?: ts.CompilerOptions

  /**
   * The path to the `tsconfig.json` file. If not provided, it will
   * use the `tsconfig.json` file in the current working directory.
   */
  tsconfigPath?: string

  /**
   * The current working directory. If not provided, it will
   * use the current working directory of the process.
   */
  cwd?: string

  /**
   * The root directory of the source files. Please note,
   * it is relative to the current working directory.
   * @default 'src'
   */
  root?: string

  /**
   * The output directory of the declaration files. Please note,
   * it is relative to the current working directory.
   * @default 'dist/types'
   */
  outdir?: ts.CompilerOptions['outDir']

  /**
   * The files to include. If not provided, it will include all files in the
   * `tsconfig.json` file, or the Bun build entry points if provided.
   */
  include?: string[]
}

/**
 * Generate declaration files for the TypeScript source files.
 * @param entryPoints The entry points of the TypeScript source files.
 * @param options The options for generating the declaration files.
 */
export async function generate(entryPoints: string | string[], options?: DtsOptions): Promise<void> {
  const cwd = options?.cwd ?? process.cwd()
  const configPath = p.resolve(cwd, 'tsconfig.json')
  const root = (options?.root ?? 'src').replace(/^\.\//, '')

  console.log('TSConfig path:', configPath)
  console.log('Root directory:', root)

  try {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
      throw new Error(`Failed to read tsconfig: ${configFile.error.messageText}`)
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, cwd)

    if (parsedCommandLine.errors.length) {
      throw new Error(`Failed to parse tsconfig: ${parsedCommandLine.errors.map((e) => e.messageText).join(', ')}`)
    }

    const compilerOptions: ts.CompilerOptions = {
      ...parsedCommandLine.options,
      ...options?.compiler,
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      outDir: './dist',
    }

    console.log('Compiler Options:', JSON.stringify(compilerOptions, null, 2))

    const host = ts.createCompilerHost(compilerOptions)

    const program = ts.createProgram({
      rootNames: parsedCommandLine.fileNames,
      options: compilerOptions,
      host,
    })

    const emitResult = program.emit(undefined, (fileName, data) => {
      if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.ts.map')) {
        const outputPath = p.join(compilerOptions.outDir!, p.relative(p.resolve(cwd, root), fileName))
        const dir = p.dirname(outputPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(outputPath, data)
        console.log('Emitted:', outputPath)
      }
    })

    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

    if (allDiagnostics.length) {
      const formatHost: ts.FormatDiagnosticsHost = {
        getCanonicalFileName: (path) => path,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
      }
      const message = ts.formatDiagnosticsWithColorAndContext(allDiagnostics, formatHost)
      console.error(message)
    }

    if (emitResult.emitSkipped) {
      throw new Error('TypeScript compilation failed')
    }
  } catch (error) {
    console.error('Error generating types:', error)
    throw error
  }
}

/**
 * A Bun plugin to generate declaration files for the TypeScript source files.
 * @param options The options for generating the declaration files.
 */
export function dts(options?: DtsOptions): BunPlugin {
  return {
    name: 'bun-plugin-dts-auto',

    async setup(build) {
      const entrypoints = [...build.config.entrypoints].sort()
      const root = options?.root ?? build.config.root ?? 'src'

      await generate(entrypoints, {
        root,
        include: entrypoints,
        cwd: options?.cwd || process.cwd(),
        ...options,
      })
    },
  }
}

export default dts
