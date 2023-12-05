import { fs, glob } from 'stacks:storage'

export async function generateVueCompat(paths: string[]) {
  const files = await glob(paths, {
    onlyFiles: true,
  })

  for (const f of files) {
    const raw = await fs.readFile(f, 'utf-8')
    const changed = raw
      .replace(/"@vue\/composition-api"/g, '\'vue-demi\'')
      .replace(/"vue"/g, '\'vue-demi\'')
      .replace(/'vue'/g, '\'vue-demi\'')
    await fs.writeFile(f, changed, 'utf-8')
  }
}
