import { log } from 'src/logging/src'
import { customElementsDataPath } from 'src/path/src'
import { writeTextFile } from 'src/storage/src'
import library from '~/config/library'

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
  const componentsData = JSON.stringify(library.vueComponents?.tags)

  return `{
  "version": 1.1,
  "tags": ${componentsData}
}
`
}
