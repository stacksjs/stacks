import { watch } from 'fs'
import { path } from '@stacksjs/path'

watch(path.userModelsPath(), async (event, filename) => {
  await Bun.$`bun ../orm/generate-model.ts`

  console.log('generated orm models')
})
