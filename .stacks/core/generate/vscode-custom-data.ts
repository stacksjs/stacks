import consola from 'consola'
import { customElementsDataPath, writeTextFile } from '..'
import { tags } from '../../../config/components'

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
  const tagsData = JSON.stringify(tags)

  return `{
  "version": 1.1,
  "tags": ${tagsData}
}
`
}
