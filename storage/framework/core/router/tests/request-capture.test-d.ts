// Exercise the declarations apps install, including the generic return type.
// eslint-disable-next-line pickier/no-import-dist
import { beginRequestCapture, createRequestCapture, finishRequestCapture, flushRequestCaptures, observeHttpRequest, skipRequestCapture } from '../dist/request-capture'
// eslint-disable-next-line pickier/no-import-dist
import type { CapturedRequest, RequestCapture } from '../dist/request-capture'

const request = new Request('http://localhost/example')
const started: boolean = beginRequestCapture(request)
finishRequestCapture(request, new Response())
skipRequestCapture(request)
const synchronous: Response = observeHttpRequest(request, () => new Response())
const asynchronous: Promise<Response> = observeHttpRequest(request, async () => new Response())
const flushing: Promise<void> = flushRequestCaptures()
const capture: RequestCapture = createRequestCapture({
  enabled: () => true,
  store: async (row: CapturedRequest) => { const method: string = row.method; void method },
})
void [started, synchronous, asynchronous, flushing, capture]
