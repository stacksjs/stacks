// TODO: this needs to be dynamic

import { defineCustomElement } from '@ow3/stacks'
import { HelloWorld } from '@ow3/hello-world-stack'

const HelloWorldCustomElement = defineCustomElement(HelloWorld)

customElements.define('hello-world', HelloWorldCustomElement)
