import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'

export default new Action({
  name: 'ServerIndexAction',
  description: 'Returns server configuration from config files.',
  method: 'GET',
  async handle() {
    try {
      const cloudConfig = config.cloud || {}
      const servers: Array<Record<string, unknown>> = []

      // Read compute configuration from config/cloud.ts
      const infra = (cloudConfig as any).infrastructure ?? (cloudConfig as any)
      const compute = infra?.compute ?? (cloudConfig as any).compute

      if (compute) {
        const diskSize = compute.disk?.size ? `${compute.disk.size}GB` : '20GB'
        const diskType = compute.disk?.type ?? 'ssd'

        servers.push({
          name: 'App Server',
          type: compute.size || 'small',
          instances: compute.instances || 1,
          storage: diskSize,
          diskType,
          encrypted: compute.disk?.encrypted ?? false,
          status: 'configured',
        })
      }

      // Read server definitions from config/cloud.ts infrastructure.servers
      const serverDefs = infra?.servers ?? {}
      for (const [key, value] of Object.entries(serverDefs)) {
        if (value && typeof value === 'object') {
          servers.push({
            name: key,
            ...value as Record<string, unknown>,
            status: 'configured',
          })
        }
        else if (value) {
          servers.push({
            name: key,
            reference: String(value),
            status: 'configured',
          })
        }
      }

      // Read container configuration if present
      const containers = infra?.containers ?? {}
      const containerList: Array<Record<string, unknown>> = []
      for (const [name, containerConfig] of Object.entries(containers)) {
        if (containerConfig && typeof containerConfig === 'object') {
          containerList.push({
            name,
            ...containerConfig as Record<string, unknown>,
          })
        }
      }

      // Read load balancer configuration
      const loadBalancer = infra?.loadBalancer ?? {}

      // Read SSL configuration
      const ssl = infra?.ssl ?? {}

      // Read DNS configuration from cloud config
      const dns = infra?.dns ?? {}

      // Read storage buckets
      const storageBuckets = infra?.storage ?? {}
      const bucketNames = Object.keys(storageBuckets)

      // Build stats from actual config
      const totalServers = servers.length
      const mode = (cloudConfig as any).mode ?? 'server'

      const stats = [
        { label: 'Total Servers', value: String(totalServers) },
        { label: 'Mode', value: mode },
        { label: 'Region', value: String((cloudConfig as any).project?.region ?? infra?.dns?.domain ?? 'us-east-1') },
        { label: 'Storage Buckets', value: String(bucketNames.length) },
      ]

      return {
        servers,
        containers: containerList,
        loadBalancer,
        ssl,
        dns,
        storageBuckets: bucketNames,
        stats,
      }
    }
    catch {
      return { servers: [], containers: [], stats: [] }
    }
  },
})
