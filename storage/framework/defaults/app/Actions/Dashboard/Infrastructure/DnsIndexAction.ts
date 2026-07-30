import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { tsCloud } from '~/config/cloud'
import { getDashboardDnsSnapshot } from './dns-overview'

export default new Action({
  name: 'DnsIndexAction',
  description: 'Returns DNS configuration from config files.',
  method: 'GET',
  async handle() {
    return getDashboardDnsSnapshot(config.dns, tsCloud)
  },
})
