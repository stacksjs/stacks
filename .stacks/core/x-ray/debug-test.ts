import { dd, debug, ray } from './src/index'

// eslint-disable-next-line no-console
console.log('here', debug('hello').send())
debug('hello').send()
ray('hello')

dd(new Error('test'))
