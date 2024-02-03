import { $ } from 'bun'

await $`echo 'test'`

await $`cp -r ../../../config ./config`
await $`cp -r ../../../routes ./routes`

await $`docker build --pull -t stacks-test .`
