import { createApp } from 'vue'
import App from './app.stx'
import '@unocss/reset/tailwind.css'

// import { unifiedApp } from './plugins/unified/unified-app'
const app = createApp(App)

app.mount('#app')
