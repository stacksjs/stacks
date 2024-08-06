import { path } from '@stacksjs/path'
import { watch } from '@stacksjs/storage'

watch(path.userModelsPath(), async (event, filename) => {
  await Bun.$`bun ../orm/generate-model.ts`

  console.log('generated orm models')
})
