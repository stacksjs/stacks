import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CloudIndexAction',
  description: 'Returns cloud services overview for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      services: [
        { name: 'EC2 Instance', type: 'compute', status: 'running', region: 'us-east-1', uptime: '99.99%', cost: '$45.20/mo' },
        { name: 'S3 Bucket', type: 'storage', status: 'active', region: 'us-east-1', size: '2.4 GB', cost: '$0.54/mo' },
        { name: 'CloudFront Distribution', type: 'cdn', status: 'deployed', region: 'global', requests: '1.2M/mo', cost: '$12.30/mo' },
        { name: 'Route53', type: 'dns', status: 'active', region: 'global', zones: 3, cost: '$1.50/mo' },
      ],
      totalMonthlyCost: '$59.54',
      region: 'us-east-1',
    }
  },
})
