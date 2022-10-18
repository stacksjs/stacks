import consola from 'consola'
import { writeTextFile } from 'utils'
import { customElementsDataPath } from 'stacks'
import { library } from 'config'

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
    consola.error(err)
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
