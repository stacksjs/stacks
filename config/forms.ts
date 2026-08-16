import type { FormsConfig } from '@stacksjs/types'

/**
 * **Forms Configuration**
 *
 * Controls the form-builder bundle (Form / FormField / FormSubmission
 * models, public submit endpoints, CSV export). Manage via
 * `./buddy forms:install` / `./buddy forms:uninstall`.
 */
export default {
  enabled: false,

  uploads: {
    maxSizeMb: 10,
    allowedTypes: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx'],
  },

  spam: {
    honeypot: true,
    minSubmitSeconds: 3,
  },
} satisfies FormsConfig
