/**
 * Translation Loader
 *
 * Load translations from JSON, YAML, or TypeScript/JavaScript files.
 */

import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { log } from '@stacksjs/logging'
import type { TranslationMessages, Translations } from './types'
import { addTranslations, loadTranslations } from './translator'

export interface LoaderOptions {
  /**
   * Directory containing translation files
   */
  directory: string

  /**
   * File extensions to load
   * @default ['.json', '.yaml', '.yml', '.ts', '.js']
   */
  extensions?: string[]

  /**
   * Whether to load files recursively
   * @default false
   */
  recursive?: boolean

  /**
   * Namespace separator for nested directories
   * @default '.'
   */
  namespaceSeparator?: string
}

/**
 * Load translations from a directory
 */
export async function loadFromDirectory(options: LoaderOptions): Promise<Translations> {
  const {
    directory,
    extensions = ['.json', '.yaml', '.yml', '.ts', '.js'],
    recursive = false,
    namespaceSeparator = '.',
  } = options

  const translations: Translations = {}

  if (!existsSync(directory)) {
    log.warn(`[i18n] Translation directory not found: ${directory}`)
    return translations
  }

  await loadDirectory(directory, translations, extensions, recursive, namespaceSeparator, '')

  // Also register with global i18n
  loadTranslations(translations)

  return translations
}

/**
 * Recursively load a directory
 */
async function loadDirectory(
  dir: string,
  translations: Translations,
  extensions: string[],
  recursive: boolean,
  namespaceSeparator: string,
  namespace: string,
): Promise<void> {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      // Check if this is a locale directory (e.g., "en", "fr", "de")
      const locale = entry.name

      // If it looks like a locale code, load all files in it as that locale
      if (isLocaleCode(locale)) {
        await loadLocaleDirectory(fullPath, locale, translations, extensions)
      }
      else if (recursive) {
        // Otherwise, treat as namespace
        const newNamespace = namespace
          ? `${namespace}${namespaceSeparator}${entry.name}`
          : entry.name

        await loadDirectory(
          fullPath,
          translations,
          extensions,
          recursive,
          namespaceSeparator,
          newNamespace,
        )
      }
    }
    else if (entry.isFile()) {
      const ext = extname(entry.name)

      if (extensions.includes(ext)) {
        // File name (without extension) is the locale
        const locale = basename(entry.name, ext)

        if (!translations[locale]) {
          translations[locale] = {}
        }

        const messages = await loadFile(fullPath)

        if (namespace) {
          // Nest under namespace
          setNested(translations[locale], namespace, messages, namespaceSeparator)
        }
        else {
          // Merge at root
          translations[locale] = deepMerge(translations[locale], messages)
        }
      }
    }
  }
}

/**
 * Load all translation files in a locale directory
 */
async function loadLocaleDirectory(
  dir: string,
  locale: string,
  translations: Translations,
  extensions: string[],
): Promise<void> {
  if (!translations[locale]) {
    translations[locale] = {}
  }

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const ext = extname(entry.name)
    if (!extensions.includes(ext)) continue

    const fullPath = join(dir, entry.name)
    const namespace = basename(entry.name, ext)

    const messages = await loadFile(fullPath)

    // If the file is named after the locale (e.g., "en.json" in "en" folder), merge at root
    if (namespace === locale) {
      translations[locale] = deepMerge(translations[locale], messages)
    }
    else {
      // Otherwise, use filename as namespace
      translations[locale][namespace] = messages
    }
  }
}

/**
 * Load a single translation file
 */
export async function loadFile(filePath: string): Promise<TranslationMessages> {
  const ext = extname(filePath).toLowerCase()
  const content = await readFile(filePath, 'utf8')

  switch (ext) {
    case '.json':
      return JSON.parse(content)

    case '.yaml':
    case '.yml':
      return parseYaml(content)

    case '.ts':
    case '.js': {
      // Dynamic import for JS/TS files
      const module = await import(filePath)
      return module.default || module
    }

    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}

/**
 * Load a single locale from a file or directory
 */
export async function loadLocale(
  locale: string,
  path: string,
): Promise<TranslationMessages> {
  const messages = await loadFile(path)
  addTranslations(locale, messages)
  return messages
}

/**
 * Simple YAML parser for translation files
 * Supports basic key-value pairs and nested objects
 */
function parseYaml(content: string): TranslationMessages {
  const result: TranslationMessages = {}
  const lines = content.split('\n')
  const stack: Array<{ indent: number, obj: TranslationMessages }> = [{ indent: -1, obj: result }]

  for (let line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Calculate indentation
    const indent = line.search(/\S/)
    line = line.trim()

    // Skip lines that don't look like key-value pairs
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    // Pop stack until we find the right parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].obj

    if (value) {
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1)
      }
      parent[key] = value
    }
    else {
      // Nested object
      parent[key] = {}
      stack.push({ indent, obj: parent[key] as TranslationMessages })
    }
  }

  return result
}

/**
 * Check if a string looks like a locale code
 */
function isLocaleCode(str: string): boolean {
  // Match patterns like "en", "en-US", "zh-Hans", etc.
  return /^[a-z]{2}(-[A-Z]{2})?(-[A-Za-z]+)?$/i.test(str)
}

/**
 * Set a nested value in an object
 */
function setNested(
  obj: TranslationMessages,
  path: string,
  value: TranslationMessages,
  separator: string,
): void {
  const parts = path.split(separator)
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part] || typeof current[part] === 'string') {
      current[part] = {}
    }
    current = current[part] as TranslationMessages
  }

  const lastPart = parts[parts.length - 1]
  current[lastPart] = value
}

/**
 * Deep merge two objects
 */
function deepMerge(target: TranslationMessages, source: TranslationMessages): TranslationMessages {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      typeof sourceValue === 'object'
      && sourceValue !== null
      && typeof targetValue === 'object'
      && targetValue !== null
    ) {
      result[key] = deepMerge(
        targetValue as TranslationMessages,
        sourceValue as TranslationMessages,
      )
    }
    else {
      result[key] = sourceValue
    }
  }

  return result
}

/**
 * Create a translation loader for a specific directory
 */
export function createLoader(directory: string, options: Partial<Omit<LoaderOptions, 'directory'>> = {}) {
  return {
    load: () => loadFromDirectory({ directory, ...options }),
    loadLocale: (locale: string, filename: string) => loadLocale(locale, join(directory, filename)),
  }
}
