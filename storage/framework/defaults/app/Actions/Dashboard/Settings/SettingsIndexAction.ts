import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SettingsIndexAction',
  description: 'Returns application settings for the dashboard settings page.',
  method: 'GET',
  async handle() {
    const generalSettings = [
      { key: 'Site Name', value: 'Stacks', type: 'text' },
      { key: 'Site URL', value: 'https://stacks.dev', type: 'text' },
      { key: 'Admin Email', value: 'admin@stacks.dev', type: 'email' },
      { key: 'Timezone', value: 'America/New_York', type: 'select' },
      { key: 'Language', value: 'English', type: 'select' },
    ]

    const securitySettings = [
      { key: 'Two-Factor Authentication', value: true, type: 'toggle' },
      { key: 'Session Timeout', value: '30 minutes', type: 'select' },
      { key: 'Password Requirements', value: 'Strong', type: 'select' },
      { key: 'IP Whitelist', value: 'Disabled', type: 'toggle' },
    ]

    const notificationSettings = [
      { key: 'Email Notifications', value: true, type: 'toggle' },
      { key: 'Push Notifications', value: true, type: 'toggle' },
      { key: 'Weekly Digest', value: false, type: 'toggle' },
      { key: 'Error Alerts', value: true, type: 'toggle' },
    ]

    const integrations = [
      { name: 'Stripe', status: 'connected', icon: 'creditcard' },
      { name: 'SendGrid', status: 'connected', icon: 'envelope' },
      { name: 'Cloudflare', status: 'connected', icon: 'cloud' },
      { name: 'GitHub', status: 'connected', icon: 'chevron.left.forwardslash.chevron.right' },
      { name: 'Slack', status: 'not_connected', icon: 'bubble.left.and.bubble.right' },
    ]

    return { generalSettings, securitySettings, notificationSettings, integrations }
  },
})
