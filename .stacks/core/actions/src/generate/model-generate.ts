import { path as p } from '@stacksjs/path'

const modelGenerate = Bun.file('model-classes.ts') // Assuming Bun is imported properly
const file = Bun.file(p.projectStoragePath('framework/orm/UserModel.ts'))

const code = await modelGenerate.text()

const writer = file.writer()

writer.write(code)

await writer.end()