/**
 * Code generation templates for the make command
 * 
 * These templates use the {0}, {1}, etc. format for template substitution
 * which works with the @stacksjs/strings template function
 */

export const CODE_TEMPLATES = {
  action: `import { Action } from '@stacksjs/actions'

export default new Action({
  name: '{0}',
  description: '{0} action',

  handle() {
    return 'Hello World action'
  },
})`,

  component: `<script setup lang="ts">
console.log('Hello World component created')
</script>

<template>
  <div>
    Some HTML block
  </div>
</template>`,

  page: `<script setup lang="ts">
console.log('Hello World page created')
</script>

<template>
  <div>
    Visit http://127.0.0.1/{0}
  </div>
</template>`,

  function: `// reactive state
const {0} = ref(0)

// functions that mutate state and trigger updates
function increment() {
  {0}.value++
}

export {
  {0},
  increment,
}`,

  language: `button:
  text: Copy`,

  notification: `import type { {0} } from '@stacksjs/types'

function content(): string {
  return 'example'
}

function send(): {0} {
  return {
    content: content(),
  }
}`,

  middleware: `import type { Request } from '@stacksjs/router'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: '{0}',
  priority: 1,
  async handle(request: Request) {
    // Your middleware logic here
  },
})`,

  model: `import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: '{0}',

  traits: {
    useTimestamps: true,

    useSeeder: {
      count: 10,
    },
  },

  attributes: {
    // your attributes here
  },
} satisfies Model`,

  migration: `import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('{0}')
    .addColumn('id', 'integer', col => col.autoIncrement().primaryKey())
    .execute()
}`,

  // Add more templates as needed
  job: `import { Job } from '@stacksjs/jobs'

export default new Job({
  name: '{0}',
  description: '{0} job',

  async handle() {
    // Your job logic here
    console.log('Job executed')
  },
})`,

  event: `import { Event } from '@stacksjs/events'

export default new Event({
  name: '{0}',
  description: '{0} event',

  async handle(data: any) {
    // Your event handler logic here
    console.log('Event handled:', data)
  },
})`,

  listener: `import { Listener } from '@stacksjs/events'

export default new Listener({
  name: '{0}',
  description: '{0} listener',

  async handle(data: any) {
    // Your listener logic here
    console.log('Listener triggered:', data)
  },
})`,

  command: `import { Command } from '@stacksjs/cli'

export default new Command({
  name: '{0}',
  description: '{0} command',

  async handle() {
    // Your command logic here
    console.log('Command executed')
  },
})`,
} as const

export type TemplateKey = keyof typeof CODE_TEMPLATES 