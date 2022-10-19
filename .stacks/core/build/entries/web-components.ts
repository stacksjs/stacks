import '@unocss/reset/tailwind.css'
import { defineCustomElement } from 'vue'
import AppHelloWorld from '../../../../components/HelloWorld.vue'
import Demo from '../../../../components/Demo.vue'
const AppHelloWorldCustomElement = defineCustomElement(AppHelloWorld)
const DemoCustomElement = defineCustomElement(Demo)
customElements.define('app-hello-world', AppHelloWorldCustomElement)
customElements.define('demo', DemoCustomElement)
