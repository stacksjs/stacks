/**
 * Which files `buddy lint` lints, as a pure predicate.
 *
 * Kept free of imports so the Stacks VS Code extension
 * (storage/framework/defaults/ide/vscode) can bundle it and lint exactly the
 * files the command does, instead of a second list that drifts.
 */

const lintableFile = /\.(?:ts|js|stx|json|md|yaml|yml)$/i
const ignoredPath = /(?:^|\/)(?:node_modules|dist|pantry|storage\/framework\/cache|\.git|\.stx|\.stx-serve)(?:\/|$)/

/** Whether `buddy lint` lints `file`, a path relative to the project root with `/` separators. */
export function isLintablePath(file: string): boolean {
  return isLintableExtension(file) && !isIgnoredLocation(file)
}

/** Whether the file's extension is one `buddy lint` reads at all. */
export function isLintableExtension(file: string): boolean {
  return lintableFile.test(file)
}

/**
 * Whether the file sits somewhere `buddy lint` never looks (dependencies,
 * build output, caches). Separate from the extension test so a caller who
 * names such a path is told it is the location, not the file type.
 */
export function isIgnoredLocation(file: string): boolean {
  return ignoredPath.test(file)
}
