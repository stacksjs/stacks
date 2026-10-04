/**
 * Fails when an extension this one installs is not on the VS Code Marketplace.
 *
 * VS Code installs an `extensionPack` (and `extensionDependencies`) member by
 * ID when it installs this extension, and refuses the whole install when one
 * of them does not exist. `vsce publish` does not check, so publishing a pack
 * that names an unpublished extension ships an extension nobody can install.
 * The release workflow runs this before `vsce publish`.
 *
 * The case it was written for: `Stacks.vscode-stx` is published from
 * stacksjs/stx, on that repository's release, and this pack names it
 * (stacksjs/stx#2020).
 */

const GALLERY = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'

/** Looks one extension ID up in the marketplace, by its full `publisher.name`. */
export type GalleryLookup = (id: string) => Promise<boolean>

export const marketplaceHas: GalleryLookup = async (id) => {
  const response = await fetch(GALLERY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json;api-version=7.2-preview.1',
    },
    // filterType 7 is the extension name; flags 0 asks for no detail.
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: id }] }], flags: 0 }),
  })

  if (!response.ok)
    throw new Error(`The marketplace answered ${response.status} for ${id}`)

  const body = await response.json() as { results?: Array<{ extensions?: Array<{ extensionName: string, publisher: { publisherName: string } }> }> }
  const found = body.results?.[0]?.extensions ?? []

  // Marketplace IDs are case-insensitive.
  return found.some(extension => `${extension.publisher.publisherName}.${extension.extensionName}`.toLowerCase() === id.toLowerCase())
}

/** Every extension installing this one also installs. */
export function bundledExtensions(manifest: { extensionPack?: string[], extensionDependencies?: string[] }): string[] {
  return [...new Set([...(manifest.extensionPack ?? []), ...(manifest.extensionDependencies ?? [])])]
}

export async function missingFromMarketplace(ids: string[], has: GalleryLookup = marketplaceHas): Promise<string[]> {
  const found = await Promise.all(ids.map(has))
  return ids.filter((_, index) => !found[index])
}

if (import.meta.main) {
  const manifest = await Bun.file(new URL('../package.json', import.meta.url)).json()
  const ids = bundledExtensions(manifest)
  const missing = await missingFromMarketplace(ids)

  if (missing.length > 0) {
    console.error(`Not on the VS Code Marketplace: ${missing.join(', ')}.`)
    console.error(`Publishing ${manifest.publisher}.${manifest.name} now would ship a pack VS Code refuses to install. Publish those first.`)
    process.exit(1)
  }

  console.log(`All ${ids.length} bundled extensions are on the marketplace.`)
}
