import { join } from 'node:path'

const archives = {
  PLACEHOLDER_SHA_ARM64: 'buddy-darwin-arm64.zip',
  PLACEHOLDER_SHA_X64: 'buddy-darwin-x64.zip',
  PLACEHOLDER_SHA_LINUX_ARM64: 'buddy-linux-arm64.zip',
  PLACEHOLDER_SHA_LINUX_X64: 'buddy-linux-x64.zip',
} as const

/** Generate a formula from release bytes without executing a platform binary. */
export async function updateHomebrewFormula(version: string, options: { root?: string, releaseOrigin?: string } = {}): Promise<void> {
  if (!/^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version))
    throw new Error('Pass a semantic release version')
  const number = version.replace(/^v/, '')
  const root = options.root ?? process.cwd()
  const formulaPath = join(root, '.github/homebrew/stacks.rb')
  const template = await Bun.file(formulaPath).text()
  if ((template.match(/^\s*version "[^"]*"/gm) ?? []).length !== 1)
    throw new Error('Expected one formula version')
  let formula = template.replace(/^(\s*version )"[^"]*"/m, `$1"${number}"`)
  for (const [placeholder, archive] of Object.entries(archives)) {
    if (template.split(placeholder).length !== 2)
      throw new Error(`Expected one ${placeholder} in the formula template`)
    const path = join(root, '.github/temp', archive)
    if (!await Bun.file(path).exists()) {
      const origin = options.releaseOrigin ?? 'https://github.com'
      const response = await fetch(`${origin}/stacksjs/stacks/releases/download/v${number}/${archive}`, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`Could not download ${archive}: HTTP ${response.status}`)
      const bytes = await response.arrayBuffer()
      if (!bytes.byteLength) throw new Error(`Empty release archive: ${archive}`)
      await Bun.write(path, bytes)
    }
    const bytes = await Bun.file(path).arrayBuffer()
    if (!bytes.byteLength) throw new Error(`Empty release archive: ${archive}`)
    const checksum = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
    formula = formula.replace(placeholder, checksum)
  }
  // Validate every input before replacing the tracked template.
  await Bun.write(formulaPath, formula)
}

if (import.meta.main) {
  const version = Bun.argv[2]
  if (!version) throw new Error('Pass a semantic release version')
  await updateHomebrewFormula(version)
  console.log(`Updated the Homebrew formula for ${version}`)
}
