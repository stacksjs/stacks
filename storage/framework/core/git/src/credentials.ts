export interface GitCredentialOptions {
  /** Canonical HTTP(S) repository URL, including its repository path. */
  url: string
  username: string
  password: string
}

// Git passes credential fields on stdin. The command contains variable names,
// never their secret values, and neither stores nor erases credentials.
const helper = `!f() {
  [ "$1" = get ] || return 0
  credential_protocol= credential_host= credential_path=
  while IFS= read -r credential_line; do
    [ -n "$credential_line" ] || break
    case "$credential_line" in
      protocol=*) credential_protocol=\${credential_line#protocol=} ;;
      host=*) credential_host=\${credential_line#host=} ;;
      path=*) credential_path=\${credential_line#path=} ;;
    esac
  done
  [ "$credential_protocol" = "$STACKS_GIT_HTTP_PROTOCOL" ] || return 0
  credential_host=$(printf '%s' "$credential_host" | tr '[:upper:]' '[:lower:]')
  case "$credential_protocol" in
    https) credential_host=\${credential_host%:443} ;;
    http) credential_host=\${credential_host%:80} ;;
  esac
  [ "$credential_host" = "$STACKS_GIT_HTTP_HOST" ] || return 0
  [ "\${credential_path%/}" = "$STACKS_GIT_HTTP_PATH" ] || return 0
  printf 'username=%s\\npassword=%s\\n\\n' "$STACKS_GIT_HTTP_USERNAME" "$STACKS_GIT_HTTP_PASSWORD"
}; f`

/**
 * Scope non-interactive Git HTTP authentication to one repository for a child
 * process. Pass the caller's environment as the second argument and merge the
 * result after it. Existing runtime Git config is retained. Do not log the map.
 * No credential file, remote URL, Git config file or command argument receives
 * the password. Redirects for this repository are refused rather than sending
 * its authenticated requests to a different location.
 */
export function gitCredentialEnvironment(options: GitCredentialOptions, baseEnvironment: Record<string, string | undefined> = {}): Record<string, string> {
  let url: URL
  try { url = new URL(options.url) }
  catch { throw new TypeError('Git credentials require an absolute HTTP(S) repository URL') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname === '/')
    throw new TypeError('Git credentials require a repository URL without credentials, query or fragment')
  let path: string
  try { path = decodeURIComponent(url.pathname.slice(1)).replace(/\/+$/, '') }
  catch { throw new TypeError('Git credentials require a valid percent-encoded repository path') }
  if (!path || /[\r\n\0]/.test(path))
    throw new TypeError('Git credentials require a single-line repository path')
  for (const value of [options.username, options.password]) {
    if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value))
      throw new TypeError('Git credentials must be non-empty single-line values')
  }
  const existingCount = baseEnvironment.GIT_CONFIG_COUNT
  const count = existingCount === undefined ? 0 : Number(existingCount)
  if ((existingCount !== undefined && !/^\d+$/.test(existingCount)) || !Number.isSafeInteger(count) || count > Number.MAX_SAFE_INTEGER - 4)
    throw new TypeError('Git runtime configuration count must be a non-negative integer')
  for (let index = 0; index < count; index++) {
    if (!baseEnvironment[`GIT_CONFIG_KEY_${index}`] || baseEnvironment[`GIT_CONFIG_VALUE_${index}`] === undefined)
      throw new TypeError('Git runtime configuration requires every existing key and value')
  }
  const environment: Record<string, string> = {
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_CONFIG_COUNT: String(count + 4),
    STACKS_GIT_HTTP_PROTOCOL: url.protocol.slice(0, -1),
    STACKS_GIT_HTTP_HOST: url.host,
    STACKS_GIT_HTTP_PATH: path,
    STACKS_GIT_HTTP_USERNAME: options.username,
    STACKS_GIT_HTTP_PASSWORD: options.password,
  }
  const entries = [
    ['credential.helper', ''],
    ['credential.helper', helper],
    ['credential.useHttpPath', 'true'],
    [`http.${url.href}.followRedirects`, 'false'],
  ] as const
  for (const [offset, [key, value]] of entries.entries()) {
    environment[`GIT_CONFIG_KEY_${count + offset}`] = key
    environment[`GIT_CONFIG_VALUE_${count + offset}`] = value
  }
  return environment
}
