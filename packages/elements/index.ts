import { defineCustomElement } from 'vue'
import HelloWorld from '~/components/HelloWorld.vue'

// console.log('HelloWorld.styles', HelloWorld.styles) // ["/* inlined css */"]

// convert into custom element constructor
const HelloWorldCustomElement = defineCustomElement(HelloWorld)

// export individual elements
// export { HelloWorldCustomElement, AnotherCustomElement };

// export function register() {
customElements.define('hello-world', HelloWorldCustomElement)
// }
