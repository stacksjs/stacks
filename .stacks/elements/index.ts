import { HelloWorld, defineCustomElement } from '@ow3/stacks'

// TODO: need to automate this definition process
const HelloWorldCustomElement = defineCustomElement(HelloWorld)

// export function register() {
customElements.define('hello-world', HelloWorldCustomElement)
// }
