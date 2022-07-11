import { defineEventHandler } from 'h3'
import HelloWorld from '../components/dist/index.mjs'

// eslint-disable-next-line no-console
console.log('HelloWorld', HelloWorld)

export default defineEventHandler(() => '<h1>stacks loves nitro!</h1>')
