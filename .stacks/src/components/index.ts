import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Demo from '../../../components/Demo.vue'

// prepare the messages object from the yaml language files
const messages = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: any }>('../../../lang/*.y(a)?ml', { eager: true }))
    .map(([key, value]) => {
      const yaml = key.endsWith('.yaml')
      return [key.slice(14, yaml ? -5 : -4), value.default]
    }),
)

const i18n = createI18n({
  locale: defaultLanguage, // set locale
  fallbackLocale: defaultLanguage, // set fallback locale
  messages, // set locale messages
})

const app = createApp(Demo)

app.use(i18n).mount('#app')
