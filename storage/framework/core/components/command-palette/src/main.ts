import { createApp } from 'vue'
import App from './App.vue'

import highlight from './plugins/highlight'
import 'uno.css'
import '@unocss/reset/tailwind-compat.css'

import './assets/css/global.css'

const app = createApp(App)

app.use(highlight)
app.mount('#app')
