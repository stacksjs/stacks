import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CloudIndexAction',
  description: 'Returns cloud services overview for the dashboard.',
  method: 'GET',
  async handle() {
    const providers = [
      { name: 'AWS', status: 'connected', resources: 24, spend: '$1,234/mo', region: 'us-east-1' },
      { name: 'DigitalOcean', status: 'connected', resources: 8, spend: '$456/mo', region: 'nyc1' },
      { name: 'Cloudflare', status: 'connected', resources: 12, spend: '$89/mo', region: 'Global' },
      { name: 'Vercel', status: 'connected', resources: 5, spend: '$0/mo', region: 'Global' },
    ]

    const stats = [
      { label: 'Monthly Spend', value: '$1,779' },
      { label: 'Resources', value: '49' },
      { label: 'Regions', value: '4' },
      { label: 'Uptime', value: '99.99%' },
    ]

    const resources = [
      { name: 'web-server-1', type: 'EC2', provider: 'AWS', status: 'running', cost: '$45/mo' },
      { name: 'database-primary', type: 'RDS', provider: 'AWS', status: 'running', cost: '$234/mo' },
      { name: 'cdn-assets', type: 'CloudFront', provider: 'AWS', status: 'active', cost: '$12/mo' },
      { name: 'app-droplet', type: 'Droplet', provider: 'DigitalOcean', status: 'running', cost: '$48/mo' },
      { name: 'stacks-site', type: 'Pages', provider: 'Cloudflare', status: 'active', cost: '$0/mo' },
    ]

    const functions = [
      { name: 'api-handler', runtime: 'Node.js 20', invocations: '45.2K', avgDuration: '45ms', errors: 12, status: 'active' },
      { name: 'image-processor', runtime: 'Node.js 20', invocations: '12.3K', avgDuration: '234ms', errors: 3, status: 'active' },
      { name: 'email-sender', runtime: 'Node.js 20', invocations: '8.9K', avgDuration: '89ms', errors: 0, status: 'active' },
      { name: 'webhook-handler', runtime: 'Node.js 20', invocations: '23.4K', avgDuration: '56ms', errors: 5, status: 'active' },
      { name: 'cron-job', runtime: 'Node.js 20', invocations: '720', avgDuration: '1.2s', errors: 2, status: 'active' },
    ]

    const serverlessStats = [
      { label: 'Total Functions', value: '5' },
      { label: 'Invocations (24h)', value: '90.5K' },
      { label: 'Avg Duration', value: '85ms' },
      { label: 'Error Rate', value: '0.02%' },
    ]

    const edges = [
      { region: 'US East', latency: '12ms', requests: '34.5K' },
      { region: 'US West', latency: '45ms', requests: '12.3K' },
      { region: 'Europe', latency: '89ms', requests: '23.4K' },
      { region: 'Asia', latency: '156ms', requests: '8.9K' },
    ]

    return {
      providers,
      stats,
      resources,
      functions,
      serverlessStats,
      edges,
    }
  },
})
