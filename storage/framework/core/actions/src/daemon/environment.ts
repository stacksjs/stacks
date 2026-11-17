import process from 'node:process'

/**
 * The environment the daemon runs in, and the one it gives each dashboard.
 *
 * The daemon is started by whichever `buddy` first needs it, and that process
 * has a project's `.env` loaded into its environment: `APP_KEY`, `DB_DATABASE`,
 * `PORT_ADMIN` and the rest. Inherited as it is, the daemon would hand all of
 * that to every dashboard it starts, and a variable that is already set wins
 * over a project's own `.env`: the second project's dashboard would open on
 * the first project's database.
 *
 * So the daemon keeps only what describes the machine and the person, and
 * nothing that describes a project.
 */
const MACHINE_VARIABLES = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'STACKS_HOME',
  'BUN_INSTALL',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  'SSH_AUTH_SOCK',
]

/** A project's own tool directories, which its `buddy` puts first on `PATH`. */
function isProjectBin(entry: string): boolean {
  const normalized = entry.replace(/[/\\]+$/, '')
  return /[/\\](?:pantry|node_modules)[/\\]\.bin$/.test(normalized)
}

export function machineEnvironment(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const name of MACHINE_VARIABLES) {
    const value = env[name]
    if (value)
      kept[name] = value
  }

  // One project's tools must not be found first by another project's servers.
  const separator = process.platform === 'win32' ? ';' : ':'
  const path = (env.PATH ?? '').split(separator).filter(entry => entry && !isProjectBin(entry))
  if (path.length > 0)
    kept.PATH = path.join(separator)

  return kept
}
