import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref } from '@stacksjs/stx'

export interface UseWebWorkerReturn {
  data: Ref<any>
  post: (message: any) => void
  terminate: () => void
  worker: Ref<Worker | undefined>
}

/**
 * Reactive Web Worker.
 */
export function useWebWorker(url: string | URL, workerOptions?: WorkerOptions): UseWebWorkerReturn {
  const data = ref<any>(null)
  const worker = ref<Worker | undefined>(undefined)

  if (typeof Worker !== 'undefined') {
    const w = new Worker(url, workerOptions)
    worker.value = w

    w.onmessage = (e: MessageEvent) => {
      data.value = e.data
    }

    try {
      onUnmounted(() => w.terminate())
    }
    catch {
      // Not in a component context
    }
  }

  function post(message: any): void {
    worker.value?.postMessage(message)
  }

  function terminate(): void {
    worker.value?.terminate()
    worker.value = undefined
  }

  return { data, post, terminate, worker }
}

/**
 * Run a function in a Web Worker via inline blob.
 */
export function useWebWorkerFn<T extends (...args: any[]) => any>(
  fn: T,
): {
    workerFn: (...args: Parameters<T>) => Promise<ReturnType<T>>
    terminate: () => void
  } {
  let worker: Worker | undefined

  function createWorker(): Worker {
    const blob = new Blob(
      [`self.onmessage = function(e) { self.postMessage((${fn.toString()})(...e.data)); }`],
      { type: 'text/javascript' },
    )
    const url = URL.createObjectURL(blob)
    return new Worker(url)
  }

  function workerFn(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      if (typeof Worker === 'undefined') {
        // Fallback: run on main thread
        try {
          resolve(fn(...args) as ReturnType<T>)
        }
        catch (e) {
          reject(e)
        }
        return
      }

      worker = createWorker()
      worker.onmessage = (e: MessageEvent) => {
        resolve(e.data as ReturnType<T>)
        worker?.terminate()
      }
      worker.onerror = (e) => {
        reject(e)
        worker?.terminate()
      }
      worker.postMessage(args)
    })
  }

  function terminate(): void {
    worker?.terminate()
    worker = undefined
  }

  return { workerFn, terminate }
}
