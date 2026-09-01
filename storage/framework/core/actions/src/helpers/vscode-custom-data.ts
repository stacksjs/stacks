import type { Result } from '@stacksjs/error-handling'
import { config, overridesReady } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { customElementsDataPath, frameworkPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'

/**
 * The custom-elements payload, read from config that has finished loading.
 *
 * `library` is a `let` in @stacksjs/config that starts on the empty-default
 * snapshot and is reassigned once `overridesReady` settles. Reading it
 * synchronously - which is what the CLI does, straight after import - got the
 * snapshot, where `webComponents` does not exist yet. `JSON.stringify(undefined)`
 * then returns the VALUE `undefined` rather than a string, and the template
 * interpolated it literally, so `buddy generate:component-meta` wrote
 * `"tags": undefined` over a committed file: not valid JSON.
 *
 * Awaiting the overrides and reading off the live `config` proxy is what the
 * config module documents for exactly this path. The `?? []` is belt and
 * braces for a project that genuinely declares no web components - `[]` is a
 * true statement and parses; `undefined` is neither. stacksjs/stacks#2411.
 */
async function generateComponentInfoData(): Promise<string> {
  await overridesReady

  const tags = config.library?.webComponents?.tags ?? []

  // Stringify the whole document rather than interpolating one field into a
  // hand-written shell: that shell is what let a non-string `undefined` reach
  // the file in the first place, and it could not indent nested tags either.
  return `${JSON.stringify({ version: 1.1, tags }, null, 2)}\n`
}

export async function generateVsCodeCustomData(): Promise<Result<void, string>> {
  try {
    log.info('Generating custom-elements.json...')
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: customElementsDataPath(),
      data: await generateComponentInfoData(),
    })

    log.success('Generated custom-elements.json for IDEs.')

    return ok<void, string>(undefined)
  }
  catch (e) {
    log.error('There was an error generating the custom-elements.json file.', e)
    return err('There was an error generating the custom-elements.json file.')
  }
}

export async function generateWebTypes(): Promise<void> {
  log.info('Generating web-types.json...')
  await writeTextFile({
    path: frameworkPath('core/web-types.json'),
    data: await generateWebTypesData(),
  })
  log.success('Generated web-types.json for IDEs.')
}

/**
 * Same live-config read as `generateComponentInfoData` above: the snapshot has
 * no `webComponents`, so reading it synchronously produced a valid but EMPTY
 * web-types.json - a quieter failure than the corrupt one, and just as wrong.
 */
export async function generateWebTypesData(): Promise<string> {
  await overridesReady

  const library = config.library ?? ({} as NonNullable<typeof config.library>)
  const tags = (library.webComponents?.tags ?? []).map((tag) => {
    const sourceName = Array.isArray(tag.name) ? tag.name[0] : tag.name
    const publicName = Array.isArray(tag.name) ? tag.name[1] : tag.name
    return {
      name: publicName,
      description: tag.description ?? '',
      attributes: tag.attributes ?? [],
      source: {
        module: `../../defaults/resources/components/${sourceName}.stx`,
        symbol: 'default',
      },
    }
  })

  return `${JSON.stringify({
    framework: 'stx',
    name: library.name,
    contributions: {
      html: {
        'description-markup': 'markdown',
        'types-syntax': 'typescript',
        tags,
      },
    },
  }, null, 2)}\n`
}
