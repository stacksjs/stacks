import { whois } from './index'

const r = (await whois('stacksjs.com', true)).parsedData.Registrar

console.log(r)
