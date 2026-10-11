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
  return lintableFile.test(file) && !ignoredPath.test(file)
}
