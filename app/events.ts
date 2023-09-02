import type { Events } from '@stacksjs/types'

/**
 * **Events Configuration**
 *
 * This configuration defines all of your events. Think of this as your Events type definitions:
 * first, pick an event name and then define it with its return type. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */

export default {
  'user:registered': await import('./actions/SendWelcomeEmail.ts'),
} satisfies Events
