import type { Result } from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { customElementsDataPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import library from '~/config/library'

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
  log.info('This feature is not yet implemented.')
}
