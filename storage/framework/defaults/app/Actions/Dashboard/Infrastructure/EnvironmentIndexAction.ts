import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'EnvironmentIndexAction',
  description: 'Returns environment variable data for the dashboard.',
  method: 'GET',
  async handle() {
    const environments = [
      { name: 'production', url: 'https://stacks.dev', status: 'healthy', lastDeploy: '2d ago', version: '1.2.3' },
      { name: 'staging', url: 'https://staging.stacks.dev', status: 'healthy', lastDeploy: '1h ago', version: '1.2.4-beta' },
      { name: 'development', url: 'http://localhost:3000', status: 'running', lastDeploy: 'Local', version: '1.2.4-dev' },
    ]

    let variables: Array<Record<string, unknown>> = [
      { key: 'APP_NAME', value: 'Stacks', environments: ['production', 'staging', 'development'] },
      { key: 'APP_URL', value: 'https://stacks.dev', environments: ['production'] },
      { key: 'DATABASE_URL', value: '••••••••', environments: ['production', 'staging'], sensitive: true },
      { key: 'REDIS_URL', value: '••••••••', environments: ['production', 'staging'], sensitive: true },
      { key: 'DEBUG', value: 'false', environments: ['production'] },
      { key: 'DEBUG', value: 'true', environments: ['staging', 'development'] },
    ]

    let stats = [
      { label: 'Environments', value: '3' },
      { label: 'Variables', value: '24' },
      { label: 'Secrets', value: '8' },
      { label: 'Last Sync', value: '5m ago' },
    ]

    try {
      const { readFileSync } = await import('node:fs')
      const { resolve } = await import('node:path')
      const envPath = resolve(process.cwd(), '.env')
      const envContent = readFileSync(envPath, 'utf-8')
      const envLines = envContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
      const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'DATABASE_URL', 'REDIS_URL', 'API_KEY']
      const envVars: Array<Record<string, unknown>> = []
      let secretCount = 0

      for (const line of envLines) {
        const eqIdx = line.indexOf('=')
        if (eqIdx > 0) {
          const key = line.substring(0, eqIdx).trim()
          let val = line.substring(eqIdx + 1).trim()
          const isSensitive = sensitiveKeys.some(sk => key.toUpperCase().includes(sk))
          if (isSensitive) { secretCount++; val = '••••••••' }
          envVars.push({ key, value: val, environments: ['development'], sensitive: isSensitive })
        }
      }

      if (envVars.length > 0) {
        variables = envVars
        stats = [
          { label: 'Environments', value: '3' },
          { label: 'Variables', value: String(envVars.length) },
          { label: 'Secrets', value: String(secretCount) },
          { label: 'Last Sync', value: 'Now' },
        ]
      }
    }
    catch {
      // keep fallback data
    }

    return { environments, variables, stats }
  },
})
