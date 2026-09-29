export interface AuthClientArgs {
  name: string
  redirects: string[]
  personal: boolean
  password: boolean
  provider: boolean
  ownerId: number | null
  type: 'confidential' | 'public'
  scopes: string[]
  resources: string[]
}

function option(args: readonly string[], name: string, short?: string): string | undefined {
  const names = [`--${name}`, ...(short ? [`-${short}`] : [])]
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!
    for (const candidate of names) {
      if (argument.startsWith(`${candidate}=`))
        return argument.slice(candidate.length + 1)
      if (argument === candidate) {
        const value = args[index + 1]
        return value && !value.startsWith('-') ? value : undefined
      }
    }
  }
  return undefined
}

function flag(args: readonly string[], name: string): boolean {
  return args.includes(`--${name}`)
}

function list(value: string | undefined): string[] {
  return value?.split(',').map(item => item.trim()).filter(Boolean) ?? []
}

export function parseAuthClientArgs(args: readonly string[]): AuthClientArgs {
  const owner = Number(option(args, 'owner'))
  return {
    name: option(args, 'name', 'n') || 'OAuth Client',
    redirects: list(option(args, 'redirect', 'r') ?? 'http://localhost'),
    personal: flag(args, 'personal'),
    password: flag(args, 'password'),
    provider: flag(args, 'provider'),
    ownerId: Number.isSafeInteger(owner) && owner > 0 ? owner : null,
    type: flag(args, 'public') ? 'public' : 'confidential',
    scopes: list(option(args, 'scopes')),
    resources: list(option(args, 'resources')),
  }
}
