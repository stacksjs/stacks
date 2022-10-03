import '@unocss/reset/tailwind.css'
import { defineCustomElement } from 'vue'
import HalloWelt from '../../../../components/HelloWorld.vue'
import Demo from '../../../../components/Demo.vue'
const HalloWeltCustomElement = defineCustomElement(HalloWelt)
const DemoCustomElement = defineCustomElement(Demo)
customElements.define('hallo-welt', HalloWeltCustomElement)
customElements.define('demo', DemoCustomElement)
