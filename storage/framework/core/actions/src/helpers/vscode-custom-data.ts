import { log } from '@stacksjs/logging'
import { customElementsDataPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import library from '~/config/library'

export async function generateVsCodeCustomData() {
  try {
    log.info('Generating custom-elements.json...')
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: customElementsDataPath(),
      data: generateComponentInfoData(),
    })
    log.success('Generated custom-elements.json for IDEs.')
  } catch (err) {
    log.error(
      'There was an error generating the custom-elements.json file.',
      err,
    )
  }
}

export async function generateWebTypes() {
  log.info('Generating web-types.json...')
  log.info('This feature is not yet implemented.')
}

function generateComponentInfoData() {
  const componentsData = JSON.stringify(library.vueComponents?.tags)

  return `{
  "version": 1.1,
  "tags": ${componentsData}
}
`
}
