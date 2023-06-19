import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries: [
    './src/index',
    './src/drivers/dynamodb',
    './src/drivers/memcached',
    './src/drivers/redis',
    './src/drivers/upstash',
  ],

  clean: true,
  declaration: true,
})
