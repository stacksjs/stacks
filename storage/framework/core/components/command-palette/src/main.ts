import { createHead } from '@vueuse/head'
import { createApp } from 'vue'
import App from './App.vue'

import highlight from './plugins/highlight'
import 'uno.css'
import '@unocss/reset/tailwind-compat.css'

import './assets/css/global.css'

const app = createApp(App)
const head = createHead()

app.use(highlight)
app.use(head)
app.mount('#app')
