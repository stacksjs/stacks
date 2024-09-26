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
   * @default 'dist'
   */
  outdir?: ts.CompilerOptions['outDir'] // sadly, the bundler uses `outdir` instead of `outDir` and to avoid confusion, we'll use `outdir` here

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
  const configPath = options?.tsconfigPath ? p.resolve(cwd, options.tsconfigPath) : p.resolve(cwd, 'tsconfig.json')
  const root = p.resolve(cwd, (options?.root ?? 'src').replace(/^\.\//, ''))
  const outDir = p.resolve(cwd, options?.outdir ?? './dist')

  console.log('TSConfig path:', configPath)
  console.log('Root directory:', root)
  console.log('Output directory:', outDir)
  console.log('Entry points:', entryPoints)

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
      rootDir: root,
      outDir,
      declaration: true,
      emitDeclarationOnly: true,
      noEmit: false,
      skipLibCheck: true,
      isolatedModules: true,
    }

    console.log('Compiler Options:', JSON.stringify(compilerOptions, null, 2))

    const host = ts.createCompilerHost(compilerOptions)

    // Ensure entryPoints is an array and resolve to absolute paths
    const entryPointsArray = (Array.isArray(entryPoints) ? entryPoints : [entryPoints]).map((entry) =>
      p.resolve(cwd, entry),
    )

    // Use only the entry points that are within the root directory
    const validEntryPoints = entryPointsArray.filter((entry) => entry.startsWith(root))

    if (validEntryPoints.length === 0) {
      throw new Error('No valid entry points found within the specified root directory')
    }

    const program = ts.createProgram(validEntryPoints, compilerOptions, host)

    const emitResult = program.emit(undefined, (fileName, data) => {
      if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.ts.map')) {
        const outputPath = p.join(outDir, p.relative(root, fileName))
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
        tsconfigPath: options?.tsconfigPath,
        outdir: options?.outdir || build.config.outdir,
        ...options,
      })
    },
  }
}

export default dts
