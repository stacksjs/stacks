import { defineCustomElement } from 'vue'
import Demo from '../components/Demo.vue'
import HelloWorld from '../components/HelloWorld.vue'

// convert into custom element constructor
const DemoCustomElement = defineCustomElement(Demo)
const HelloWorldCustomElement = defineCustomElement(HelloWorld)

// export individual elements
// export { HelloWorldCustomElement, AnotherCustomElement };

// export function register() {
customElements.define('demo-element', DemoCustomElement)
customElements.define('hello-world', HelloWorldCustomElement)
// }
