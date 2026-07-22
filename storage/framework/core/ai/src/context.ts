import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'
import { estimateTokens } from './utils/tokens'

export const STACKS_PROJECT_CONTEXT_SCHEMA = 'https://stacksjs.org/schemas/ai-project-context/v1'

const DEFAULT_MAX_CHARS = 4000
const DEFAULT_MAX_FILES = 30

const excludedSegments = new Set([
  '.git',
  '.bun',
  '.cache',
  '.next',
  '.output',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
  'vendor',
])

const sensitiveNames = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|credentials(?:\..*)?|id_(?:rsa|ed25519)(?:\.pub)?|secrets?(?:\..*)?)$/i
const lockNames = /(?:^|\.)(?:bun|package-lock|pnpm-lock|yarn|pantry)\.?(?:lock|yaml)?$/i

export interface ProjectContextOptions {
  maxChars?: number
  maxFiles?: number
  model?: string
}

export interface ProjectContextSurface {
  id: string
  purpose: string
  paths: string[]
}

export interface StacksProjectContext {
  schema: typeof STACKS_PROJECT_CONTEXT_SCHEMA
  schemaVersion: '1.0.0'
  framework: 'stacks'
  architecture: {
    pattern: 'Model-View-Action'
    overrideRule: string
    authoringOrder: string[]
    principles: string[]
  }
  project: {
    name: string | null
    version: string | null
    scripts: string[]
    dependencies: string[]
  }
  instructionFiles: string[]
  surfaces: ProjectContextSurface[]
  representativeFiles: string[]
  exclusions: string[]
}

export interface ProjectContextMetrics {
  candidateFiles: number
  includedFiles: number
  maxCharacters: number
  outputCharacters: number
  estimatedTokens: number
  model: string
  truncated: boolean
  baselineMethod: 'sorted-first-50-paths+readme-2000+package-json'
  baselineCharacters: number
  baselineEstimatedTokens: number
  estimatedTokenReductionPercent: number | null
  tokenEstimateIsHeuristic: true
}

export interface ProjectContextResult {
  context: StacksProjectContext
  text: string
  metrics: ProjectContextMetrics
}

interface SurfaceDefinition {
  id: string
  purpose: string
  prefixes: string[]
}

const surfaceDefinitions: SurfaceDefinition[] = [
  { id: 'models', purpose: 'Domain schema, validation, relationships, factories, and traits.', prefixes: ['app/Models/', 'storage/framework/defaults/app/Models/'] },
  { id: 'actions', purpose: 'Transport-independent application behavior.', prefixes: ['app/Actions/', 'storage/framework/defaults/app/Actions/'] },
  { id: 'routes', purpose: 'HTTP and API route registration.', prefixes: ['routes/', 'app/Routes.ts'] },
  { id: 'jobs', purpose: 'Background and inline work.', prefixes: ['app/Jobs/', 'storage/framework/defaults/app/Jobs/'] },
  { id: 'configuration', purpose: 'Typed application and provider configuration.', prefixes: ['config/'] },
  { id: 'views', purpose: 'STX views, layouts, components, and client functions.', prefixes: ['resources/'] },
  { id: 'database', purpose: 'Reviewable migrations and seed data.', prefixes: ['database/'] },
  { id: 'tests', purpose: 'Unit, feature, contract, and end-to-end evidence.', prefixes: ['tests/', 'storage/framework/core/'] },
]

function normalizePath(path: string): string {
  return path.split(sep).join('/')
}

function isExcluded(path: string): boolean {
  const segments = path.split('/')
  const name = basename(path)
  return segments.some(segment => excludedSegments.has(segment))
    || sensitiveNames.test(name)
    || lockNames.test(name)
    || name.endsWith('.lock')
}

function collectFiles(root: string): string[] {
  const files: string[] = []

  function visit(directory: string): void {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const fullPath = resolve(directory, entry.name)
      const projectPath = normalizePath(relative(root, fullPath))
      if (isExcluded(projectPath)) continue
      if (entry.isDirectory()) visit(fullPath)
      else if (entry.isFile() && !lstatSync(fullPath).isSymbolicLink()) files.push(projectPath)
    }
  }

  visit(root)
  return files.sort((a, b) => a.localeCompare(b))
}

function readPackageSummary(root: string): StacksProjectContext['project'] {
  const packagePath = resolve(root, 'package.json')
  if (!existsSync(packagePath)) return { name: null, version: null, scripts: [], dependencies: [] }

  try {
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as Record<string, unknown>
    const dependencies = [
      ...Object.keys((manifest.dependencies || {}) as Record<string, unknown>),
      ...Object.keys((manifest.devDependencies || {}) as Record<string, unknown>),
      ...Object.keys((manifest.peerDependencies || {}) as Record<string, unknown>),
    ]
    return {
      name: typeof manifest.name === 'string' ? manifest.name : null,
      version: typeof manifest.version === 'string' ? manifest.version : null,
      scripts: Object.keys((manifest.scripts || {}) as Record<string, unknown>).sort().slice(0, 25),
      dependencies: [...new Set(dependencies)].sort().slice(0, 30),
    }
  }
  catch {
    return { name: null, version: null, scripts: [], dependencies: [] }
  }
}

function filePriority(path: string): number {
  if (/^(?:AGENTS|CLAUDE)\.md$|^\.github\/copilot-instructions\.md$/.test(path)) return 0
  if (path === 'package.json' || path === 'app/Routes.ts' || path === 'app/Commands.ts') return 1
  if (/^(?:app|routes|config)\//.test(path)) return 2
  if (/^(?:resources|database|tests)\//.test(path)) return 3
  if (/^docs\//.test(path)) return 4
  if (/^storage\/framework\/defaults\//.test(path)) return 5
  return 6
}

function representativeFiles(files: string[], maxFiles: number): string[] {
  return [...files]
    .sort((a, b) => filePriority(a) - filePriority(b) || a.localeCompare(b))
    .slice(0, maxFiles)
    .sort((a, b) => a.localeCompare(b))
}

function surfacePaths(files: string[], prefixes: string[]): string[] {
  return files
    .filter(file => prefixes.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix))
    .slice(0, 4)
}

function renderContext(context: StacksProjectContext): string {
  const lines = [
    'Stacks AI Project Context v1',
    '',
    `Project: ${context.project.name || 'unnamed'}${context.project.version ? `@${context.project.version}` : ''}`,
    'Architecture: Model-View-Action',
    `Override rule: ${context.architecture.overrideRule}`,
    `Authoring order: ${context.architecture.authoringOrder.join(' -> ')}`,
    '',
    'Authoring principles:',
    ...context.architecture.principles.map(principle => `- ${principle}`),
    '',
    'Instruction files:',
    ...(context.instructionFiles.length ? context.instructionFiles.map(file => `- ${file}`) : ['- none detected']),
    '',
    'Available surfaces:',
    ...context.surfaces.flatMap(surface => [
      `- ${surface.id}: ${surface.purpose}`,
      ...surface.paths.map(path => `  - ${path}`),
    ]),
    '',
    `Scripts: ${context.project.scripts.join(', ') || 'none detected'}`,
    `Dependencies: ${context.project.dependencies.join(', ') || 'none detected'}`,
    '',
    'Representative files:',
    ...context.representativeFiles.map(file => `- ${file}`),
  ]
  return lines.join('\n')
}

function fitToBudget(text: string, maxChars: number): { text: string, truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const marker = '\n[context truncated by character budget]'
  if (maxChars <= marker.length) return { text: marker.slice(0, maxChars), truncated: true }
  const available = maxChars - marker.length
  const prefix = text.slice(0, available)
  const lastLine = prefix.lastIndexOf('\n')
  return {
    text: `${prefix.slice(0, lastLine > 0 ? lastLine : available)}${marker}`,
    truncated: true,
  }
}

function unstructuredBaseline(root: string, files: string[]): string {
  const readmePath = resolve(root, 'README.md')
  const packagePath = resolve(root, 'package.json')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8').slice(0, 2000) : ''
  const packageJson = existsSync(packagePath) ? readFileSync(packagePath, 'utf8') : ''
  return [
    'Repository Structure:',
    files.slice(0, 50).join('\n'),
    readme ? `README.md (excerpt):\n${readme}` : '',
    packageJson ? `package.json:\n${packageJson}` : '',
  ].filter(Boolean).join('\n\n')
}

export function buildProjectContext(repoPath: string, options: ProjectContextOptions = {}): ProjectContextResult {
  const root = resolve(repoPath)
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const model = options.model || 'gpt-4o'
  if (!Number.isInteger(maxChars) || maxChars < 256) throw new Error('maxChars must be an integer of at least 256')
  if (!Number.isInteger(maxFiles) || maxFiles < 1) throw new Error('maxFiles must be a positive integer')

  const files = collectFiles(root)
  const included = representativeFiles(files, maxFiles)
  const context: StacksProjectContext = {
    schema: STACKS_PROJECT_CONTEXT_SCHEMA,
    schemaVersion: '1.0.0',
    framework: 'stacks',
    architecture: {
      pattern: 'Model-View-Action',
      overrideRule: 'Application files under app/ override matching framework defaults; do not edit defaults for application customization.',
      authoringOrder: ['model', 'migration', 'action', 'route', 'test'],
      principles: [
        'Prefer conventional paths and framework generators over bespoke glue code.',
        'Declare domain shape once and derive validation, migrations, API surfaces, and types where supported.',
        'Keep Actions transport-independent and make unsupported drivers fail loudly.',
        'Read repository instruction files before changing source.',
      ],
    },
    project: readPackageSummary(root),
    instructionFiles: files.filter(file => /(?:^|\/)(?:AGENTS|CLAUDE)\.md$|^\.github\/copilot-instructions\.md$/.test(file)),
    surfaces: surfaceDefinitions
      .map(surface => ({ id: surface.id, purpose: surface.purpose, paths: surfacePaths(files, surface.prefixes) }))
      .filter(surface => surface.paths.length > 0),
    representativeFiles: included,
    exclusions: [
      'dependency, build, cache, coverage, temporary, and vendor directories',
      'lockfiles',
      'environment, credential, private-key, and secret files',
    ],
  }

  const fitted = fitToBudget(renderContext(context), maxChars)
  const baseline = unstructuredBaseline(root, files)
  const outputTokens = estimateTokens(fitted.text, model)
  const baselineTokens = estimateTokens(baseline, model)
  const reduction = baselineTokens > 0
    ? Math.round((1 - outputTokens / baselineTokens) * 1000) / 10
    : null

  return {
    context,
    text: fitted.text,
    metrics: {
      candidateFiles: files.length,
      includedFiles: included.length,
      maxCharacters: maxChars,
      outputCharacters: fitted.text.length,
      estimatedTokens: outputTokens,
      model,
      truncated: fitted.truncated,
      baselineMethod: 'sorted-first-50-paths+readme-2000+package-json',
      baselineCharacters: baseline.length,
      baselineEstimatedTokens: baselineTokens,
      estimatedTokenReductionPercent: reduction,
      tokenEstimateIsHeuristic: true,
    },
  }
}
