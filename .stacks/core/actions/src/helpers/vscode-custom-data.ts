import { log } from '@stacksjs/logging'
import { customElementsDataPath } from '@stacksjs/path'
import { writeTextFile } from '@stacksjs/storage'
import { library } from '@stacksjs/config'

export async function generateVsCodeCustomData() {
  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: customElementsDataPath(),
      data: generateComponentInfoData(),
    })
  }
  catch (err) {
    log.error('There was an error generating the VS Code custom data file.', err)
  }
}

function generateComponentInfoData() {
  const componentsData = JSON.stringify(library.vueComponents.tags)

  return `{
  "version": 1.1,
  "tags": ${componentsData}
}
`
}
