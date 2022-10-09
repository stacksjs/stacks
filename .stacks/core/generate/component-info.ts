import consola from 'consola'
import { customElementsDataPath } from '../helpers'
import { tags } from '../../../config/components'

export async function generateComponentInfo() {
  consola.info('Generating your component info...')

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: customElementsDataPath(),
      data: generateComponentInfoData(),
    })

    consola.success('Generated the component info.')
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
