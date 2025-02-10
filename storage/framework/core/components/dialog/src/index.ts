import type { Plugin } from 'vue'
import Dialog from './components/Dialog.vue'
import DialogPanel from './components/DialogPanel.vue'

const plugin: Plugin = {
  install(app) {
    app.component('Dialog', Dialog)
    app.component('DialogPanel', DialogPanel)
  },
}

export { Dialog, DialogPanel }
export default plugin
