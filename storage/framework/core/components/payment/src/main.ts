import { createHead } from '@vueuse/head'
import { createApp } from 'vue'
import App from './App.vue'
import 'uno.css'
import '@unocss/reset/tailwind.css'

const app = createApp(App)
const head = createHead()

app.use(head)
app.mount('#app')
