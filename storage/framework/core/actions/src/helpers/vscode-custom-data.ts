import type { Result } from '@stacksjs/error-handling'
import { library } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { customElementsDataPath, frameworkPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'

function generateComponentInfoData(): string {
  const componentsData = JSON.stringify(library.webComponents?.tags)
  return `{
  "version": 1.1,
  "tags": ${componentsData}
}
`
}

export async function generateVsCodeCustomData(): Promise<Result<void, string>> {
  try {
    log.info('Generating custom-elements.json...')
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: customElementsDataPath(),
      data: generateComponentInfoData(),
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
    data: generateWebTypesData(),
  })
  log.success('Generated web-types.json for IDEs.')
}

export function generateWebTypesData(): string {
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
