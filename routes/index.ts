import { defineEventHandler } from 'h3'
// import HelloWorld from '../components/dist/index.js'

// need to use vite and not unbuild --stub bc of the vitejs/vue-plugin

// console.log('HelloWorld', HelloWorld)

export default defineEventHandler(() => '<h1>stacks loves nitro!</h1>')
