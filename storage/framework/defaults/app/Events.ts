import { defineEvents } from '@stacksjs/events'

/**
 * **Events Configuration**
 *
 * This configuration defines all of your events. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * Both halves of every entry are checked. The key must be an event that exists -
 * declare your own on `AppEvents` in `@stacksjs/events` - and each listener must
 * name a file under `app/Listeners/` or `app/Actions/`, or one of the framework
 * defaults behind them.
 */
export default defineEvents({
  // eventName: ['Listener1', 'Listener2'] -> listeners resolve from ./app/Listeners/*, then ./app/Actions/*
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],
})
