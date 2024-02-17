import { VueEmailPlugin } from 'vue-email'

app.use(VueEmailPlugin, {
  baseUrl: 'https://example.com',
  i18n: {
    defaultLocale: 'en',
    translations: {
      en: {
        greetings: 'Welcome {user}',
      },
      es: {
        greetings: 'Bienvenido {user}',
      },
    },
  },
  tailwind: {
    theme: {
      extend: {
        colors: {
          primary: '#ea580c',
          secondary: '#ca8a04',
        },
      },
    },
  },
})

app.mount('#app')
