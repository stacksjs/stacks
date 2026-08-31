import { tailwindPreflight as reset } from "@cwcss/crosswind"
import { defineCustomElement } from '@stacksjs/stx'
import AppHelloWorld from '/Users/glennmichaeltorregosa/Documents/Projects/stacks/resources/components/HelloWorld.stx'
const AppHelloWorldCustomElement = defineCustomElement(AppHelloWorld)
customElements.define('app-hello-world', AppHelloWorldCustomElement)