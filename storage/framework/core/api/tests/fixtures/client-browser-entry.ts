import { fetcher } from '../../src/fetcher'
import { exerciseClient } from './client-contracts'
const result = document.createElement('pre')
document.body.append(result)
try { await exerciseClient(fetcher, location.origin); result.textContent = 'client browser OK' }
catch (error) { result.textContent = `FAILED: ${String(error)}` }
