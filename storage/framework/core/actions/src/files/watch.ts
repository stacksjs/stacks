import { watch } from 'fs'

const watcher = watch('/Users/glennmichaeltorregosa/Documents/Projects/stacks/app/Models', async (event, filename) => {
  await Bun.$`bun ../orm/generate-model.ts`

  console.log('generated orm models')
})
