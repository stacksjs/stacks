import { createHead } from '@vueuse/head'
import { createApp } from 'vue'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import 'uno.css'
import highlight from './plugins/highlight'

const app = createApp(App)
const head = createHead()

app.use(head)
app.use(highlight)
app.mount('#app')
