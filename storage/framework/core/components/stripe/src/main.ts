import { createHead } from '@vueuse/head'
import { createApp } from 'vue'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'uno.css'

const app = createApp(App)
const head = createHead()

app.use(head)
app.mount('#app')
