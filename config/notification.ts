import type { NotificationConfig } from '@stacksjs/types'

/**
 * **Notification Configuration**
 *
 * This configuration defines all of your notification options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: 'email',

  /**
   * **Delivery Tracking**
   *
   * Every send is recorded to `notification_deliveries` - channel, recipient,
   * subject, status and any error - which is what the dashboard's notification
   * pages read. On by default: the value is in not having to remember to
   * enable it before the send you needed to explain.
   *
   * `channels` narrows it. Omitted or empty means every channel, so a
   * high-volume push channel can be excluded without losing the email trail:
   *
   *   tracking: { enabled: true, channels: ['email', 'sms'], body: true }
   *
   * `body: false` keeps the row but not the rendered message, for a project
   * whose notifications carry personal data it would rather not store twice.
   */
  tracking: {
    enabled: true,
    body: true,
  },
} satisfies NotificationConfig
