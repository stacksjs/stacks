import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { plugin } from 'bun'
import { autoImports } from 'bun-plugin-auto-imports'

const options: AutoImportsOptions = {
  presets: ['solid-js'], // any unimport presets are valid
  imports: [
    { name: 'AccessToken', from: '@stackjs/orm' },
    { name: 'Deployment', from: '@stackjs/orm' },
    { name: 'Error', from: '@stackjs/orm' },
    { name: 'FailedJob', from: '@stackjs/orm' },
    { name: 'Job', from: '@stackjs/orm' },
    { name: 'PaymentMethod', from: '@stackjs/orm' },
    { name: 'Post', from: '@stackjs/orm' },
    { name: 'Product', from: '@stackjs/orm' },
    { name: 'Project', from: '@stackjs/orm' },
    { name: 'Release', from: '@stackjs/orm' },
    { name: 'Subscriber', from: '@stackjs/orm' },
    { name: 'SubscriberEmail', from: '@stackjs/orm' },
    { name: 'Subscription', from: '@stackjs/orm' },
    { name: 'Team', from: '@stackjs/orm' },
    { name: 'Transaction', from: '@stackjs/orm' },
    { name: 'User', from: '@stackjs/orm' },
  ],
  dts: `./src/auto-import.d.ts`, // default is `./auto-import.d.ts`
}

export function initiateImports(): void {
  plugin(autoImports(options))
}

