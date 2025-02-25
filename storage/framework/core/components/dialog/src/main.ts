import { createHead } from '@vueuse/head'
import { createApp } from 'vue'
import App from './App.vue'

import highlight from './plugins/highlight'
import 'uno.css'

const app = createApp(App)
const head = createHead()

app.use(head)
app.use(highlight)
app.mount('#app')
