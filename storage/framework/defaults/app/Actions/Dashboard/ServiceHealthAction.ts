import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ServiceHealthAction',
  description: 'Returns service health and configuration data for the services page.',
  method: 'GET',
  async handle() {
    const { readFileSync, accessSync } = await import('node:fs')
    const { join } = await import('node:path')
    const projectRoot = process.cwd()

    function readConfig(name: string): string {
      try {
        return readFileSync(join(projectRoot, 'config', name), 'utf-8')
      }
      catch { return '' }
    }

    function extractValue(content: string, pattern: RegExp): string {
      const m = content.match(pattern)
      return m ? m[1].trim().replace(/['"]/g, '') : ''
    }

    function fileExists(p: string): boolean {
      try { accessSync(p); return true }
      catch { return false }
    }

    // Infrastructure Services
    const infra: Array<Record<string, unknown>> = []

    // Database
    const dbConf = readConfig('database.ts')
    const dbDriver = extractValue(dbConf, /default:\s*['"](\w+)['"]/) || 'sqlite'
    const dbFile = extractValue(dbConf, /filename:\s*['"]([^'"]+)['"]/) || 'database/stacks.sqlite'
    const dbHost = extractValue(dbConf, /host:\s*['"]([^'"]+)['"]/) || 'localhost'
    const dbPort = extractValue(dbConf, /port:\s*(\d+)/) || ''
    infra.push({
      name: 'Database',
      configFile: 'database.ts',
      category: 'data',
      driver: dbDriver,
      status: dbDriver === 'sqlite' && fileExists(join(projectRoot, dbFile)) ? 'running' : 'configured',
      detail: dbDriver === 'sqlite' ? dbFile : `${dbHost}${dbPort ? `:${dbPort}` : ''}`,
      fields: [{ key: 'default', label: 'Driver', value: dbDriver, options: 'sqlite,mysql,postgres,dynamodb' }],
    })

    // Cache
    const cacheConf = readConfig('cache.ts')
    const cacheDriver = extractValue(cacheConf, /driver:\s*['"](\w+)['"]/) || 'memory'
    const redisHost = extractValue(cacheConf, /host:\s*['"]([^'"]+)['"]/) || '127.0.0.1'
    const redisPort = extractValue(cacheConf, /port:\s*(\d+)/) || '6379'
    infra.push({
      name: 'Cache',
      configFile: 'cache.ts',
      category: 'data',
      driver: cacheDriver,
      status: cacheDriver === 'memory' ? 'running' : 'configured',
      detail: cacheDriver === 'redis' ? `${redisHost}:${redisPort}` : 'In-Memory',
      fields: [{ key: 'driver', label: 'Driver', value: cacheDriver, options: 'memory,redis' }],
    })

    // Queue
    const queueConf = readConfig('queue.ts')
    const queueDriver = extractValue(queueConf, /default:\s*['"](\w+)['"]/) || 'sync'
    const queueDetail = queueDriver === 'redis' ? 'Redis (bun-queue)' : queueDriver === 'database' ? 'Database' : queueDriver === 'sqs' ? 'AWS SQS' : 'Sync (dev)'
    infra.push({
      name: 'Queue',
      configFile: 'queue.ts',
      category: 'data',
      driver: queueDriver,
      status: 'configured',
      detail: queueDetail,
      fields: [{ key: 'default', label: 'Driver', value: queueDriver, options: 'sync,database,redis,sqs,memory' }],
    })

    // Search
    const searchConf = readConfig('search-engine.ts')
    const searchDriver = extractValue(searchConf, /driver:\s*['"]([^'"]+)['"]/) || 'opensearch'
    infra.push({
      name: 'Search',
      configFile: 'search-engine.ts',
      category: 'data',
      driver: searchDriver,
      status: 'configured',
      detail: searchDriver,
      fields: [{ key: 'driver', label: 'Driver', value: searchDriver, options: 'opensearch,meilisearch,algolia,typesense' }],
    })

    // Storage
    const storageConf = readConfig('filesystems.ts')
    const storageDriver = extractValue(storageConf, /driver:\s*['"](\w+)['"]/) || 'bun'
    const storageDetail = storageDriver === 's3' ? 'AWS S3' : storageDriver === 'bun' ? 'Bun Native' : 'Local FS'
    infra.push({
      name: 'Storage',
      configFile: 'filesystems.ts',
      category: 'data',
      driver: storageDriver,
      status: 'configured',
      detail: storageDetail,
      fields: [{ key: 'driver', label: 'Driver', value: storageDriver, options: 'bun,local,s3,memory' }],
    })

    // Email
    const emailConf = readConfig('email.ts')
    const emailMode = /mode:\s*['"]server['"]/.test(emailConf) ? 'server' : 'serverless'
    const emailDomain = extractValue(emailConf, /domain:\s*['"]([^'"]+)['"]/) || ''
    infra.push({
      name: 'Email',
      configFile: 'email.ts',
      category: 'communication',
      driver: emailMode === 'server' ? 'Zig Server' : 'Serverless',
      status: emailDomain ? 'running' : 'configured',
      detail: emailDomain || 'Not configured',
      fields: [
        { key: 'domain', label: 'Domain', value: emailDomain, options: '' },
        { key: 'mode', label: 'Mode', value: emailMode, options: 'server,serverless' },
      ],
    })

    // Realtime
    const realtimeConf = readConfig('realtime.ts')
    const rtPort = extractValue(realtimeConf, /port:\s*(\d+)/) || '6001'
    const rtDriver = extractValue(realtimeConf, /driver:\s*['"](\w+)['"]/) || 'socket'
    infra.push({
      name: 'Realtime',
      configFile: 'realtime.ts',
      category: 'communication',
      driver: 'WebSocket',
      status: 'configured',
      detail: `Port ${rtPort}`,
      fields: [
        { key: 'port', label: 'Port', value: rtPort, options: '' },
        { key: 'driver', label: 'Driver', value: rtDriver, options: 'socket,pusher,bun,reverb,ably' },
      ],
    })

    // AI
    const aiConf = readConfig('ai.ts')
    const aiModel = extractValue(aiConf, /default:\s*['"]([^'"]+)['"]/) || ''
    infra.push({
      name: 'AI',
      configFile: 'ai.ts',
      category: 'compute',
      driver: 'Bedrock',
      status: aiModel ? 'configured' : 'not set',
      detail: aiModel || 'Not configured',
      fields: [{ key: 'default', label: 'Model', value: aiModel, options: '' }],
    })

    // System Dependencies
    const systemDeps: Array<{ name: string, version: string }> = []
    const depsConf = readConfig('deps.ts')
    const depPattern = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g
    let depMatch
    // eslint-disable-next-line no-cond-assign
    while ((depMatch = depPattern.exec(depsConf)) !== null) {
      const depName = depMatch[1]
      const depVer = depMatch[2]
      if (depName.includes('.') || depName === 'redis' || depName === 'mailpit') {
        systemDeps.push({ name: depName, version: depVer })
      }
    }

    // Third-Party API Services
    const apiServices: Array<Record<string, unknown>> = []
    const svcConf = readConfig('services.ts')
    const keyPattern = /^ {2}(\w[\w]*)\s*:\s*\{/gm
    let svcMatch
    // eslint-disable-next-line no-cond-assign
    while ((svcMatch = keyPattern.exec(svcConf)) !== null) {
      const svcName = svcMatch[1]
      const blockStart = svcMatch.index
      let braceCount = 0
      let blockEnd = blockStart
      let inBlock = false
      for (let i = blockStart; i < svcConf.length; i++) {
        if (svcConf[i] === '{') { braceCount++; inBlock = true }
        if (svcConf[i] === '}') { braceCount-- }
        if (inBlock && braceCount === 0) { blockEnd = i; break }
      }
      const block = svcConf.substring(blockStart, blockEnd + 1)

      const svcFields: Array<Record<string, string>> = []
      const fieldPattern = /(\w+)\s*:\s*(?:env\.(\w+)\s*\?\?\s*)?['"]?([^'",\n}]*)['"]?/g
      let fm
      // eslint-disable-next-line no-cond-assign
      while ((fm = fieldPattern.exec(block)) !== null) {
        const fName = fm[1]
        if (['maxRetries', 'retryTimeout'].includes(fName)) continue
        const fValue = fm[3] ? fm[3].trim().replace(/['"]/g, '') : ''
        const envVar = fm[2] || ''
        svcFields.push({ key: fName, label: fName, value: fValue, env: envVar })
      }

      const hasEnvRef = /env\./.test(block)
      let category = 'other'
      if (['algolia', 'meilisearch'].includes(svcName)) category = 'search'
      else if (['aws', 'digitalOcean', 'hetzner'].includes(svcName)) category = 'cloud'
      else if (['github', 'google', 'facebook', 'twitter'].includes(svcName)) category = 'auth'
      else if (['mailgun', 'mailtrap', 'sendgrid', 'ses', 'smtp'].includes(svcName)) category = 'email'
      else if (['slack', 'discord', 'teams'].includes(svcName)) category = 'messaging'
      else if (['expo', 'fcm'].includes(svcName)) category = 'push'
      else if (['openai', 'anthropic', 'ollama'].includes(svcName)) category = 'ai'
      else if (['stripe'].includes(svcName)) category = 'payment'

      apiServices.push({ name: svcName, category, configured: hasEnvRef, fields: svcFields })
    }

    const categoryLabels: Record<string, string> = {
      auth: 'Authentication',
      cloud: 'Cloud',
      email: 'Email',
      messaging: 'Messaging',
      push: 'Push Notifications',
      ai: 'AI',
      payment: 'Payments',
      search: 'Search',
      other: 'Other',
    }
    const categoryOrder = ['auth', 'cloud', 'email', 'messaging', 'push', 'ai', 'payment', 'search', 'other']
    const apiCategories: Record<string, Array<Record<string, unknown>>> = {}
    for (const s of apiServices) {
      const cat = s.category as string
      if (!apiCategories[cat]) apiCategories[cat] = []
      apiCategories[cat].push(s)
    }
    const orderedApiGroups = categoryOrder
      .filter(cat => apiCategories[cat] && apiCategories[cat].length > 0)
      .map(cat => ({ key: cat, label: categoryLabels[cat] || cat, items: apiCategories[cat] }))

    const configuredApi = apiServices.filter(s => s.configured).length

    const stats = [
      { label: 'Infrastructure', value: String(infra.length) },
      { label: 'API Services', value: String(apiServices.length) },
      { label: 'System Deps', value: String(systemDeps.length) },
      { label: 'Configured', value: `${configuredApi}/${apiServices.length}` },
    ]

    return { infra, systemDeps, orderedApiGroups, stats }
  },
})
