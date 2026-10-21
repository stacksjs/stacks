/** A credential-free environment for real publication entrypoint fixtures. */
export function publicationEnvironment(source: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  // Add-Type and child process startup need Windows' own OS/runtime paths.
  // An allowlist keeps cloud, registry, signing and dotenv credentials absent.
  const paths = new Set([
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC',
    'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
    'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)',
    'COMMONPROGRAMFILES', 'COMMONPROGRAMFILES(X86)', 'PSMODULEPATH',
  ])
  return {
    ...Object.fromEntries(Object.entries(source).filter(([name]) => paths.has(name.toUpperCase()))),
    APP_ENV: 'test', NODE_ENV: 'test',
  }
}
