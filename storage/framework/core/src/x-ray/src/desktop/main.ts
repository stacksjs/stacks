// import VueHighlightJS from 'vue3-highlightjs'
import 'highlight.js/styles/atom-one-dark.css'

import { createApp } from 'vue'

import App from './app.stx'

import '@unocss/reset/tailwind.css'

// import { unifiedApp } from './plugins/unified/unified-app'
const app = createApp(App)
// app.use(VueHighlightJS)

app.mount('#app')
