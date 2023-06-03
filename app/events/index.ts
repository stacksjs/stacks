import { defineEvents } from 'stacks/core/utils'

/**
 * **Events Configuration**
 *
 * This configuration defines all of your events. Think of this as your Events type definitions:
 * first, pick an event name and then define it with its return type. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */

interface User {
  name: string
  email: string
}

export default defineEvents({
  'user:registered': (user: User) => user,
})
