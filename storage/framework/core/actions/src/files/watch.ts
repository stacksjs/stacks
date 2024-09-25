import { path } from '@stacksjs/path'
import { fsWatch as watch } from '@stacksjs/storage'

watch(path.userModelsPath(), async (event: string, filename: string) => {
  await Bun.$`bun ../orm/generate-model.ts`

  console.log('generated orm models')
})
