import type { Plugin } from 'vue'
import { Modal } from './components'

const plugin: Plugin = {
  install(app) {
    app.component('Modal', Modal)
  },
}

export default plugin

export { Modal }
