import { createApp } from 'vue'
// import Previewer from 'virtual:vue-component-preview'
import Demo from '../../../../../resources/components/Playground.vue'

import 'unocss'

// prepare the messages object from the yaml language files
// const messages = Object.fromEntries(
//   Object.entries(
//     import.meta.glob<{ default: any }>('~/lang/*.y(a)?ml', { eager: true }))
//     .map(([key, value]) => {
//       const yaml = key.endsWith('.yaml')
//       return [key.slice(14, yaml ? -5 : -4), value.default]
//     }),
// )

const app = createApp(Demo)

// app.use(Previewer)
app.mount('#app')
