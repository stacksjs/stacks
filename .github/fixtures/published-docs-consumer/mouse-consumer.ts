import { useMouse } from '@stacksjs/stx/composables'

export function trackPointer(element: HTMLElement, report: (x: number, y: number, inside: boolean) => void): () => void {
  const mouse = useMouse({ target: element })
  const unsubscribe = mouse.subscribe(({ clientX, clientY, isInside }) => {
    report(clientX, clientY, isInside)
  })
  return () => {
    unsubscribe()
    mouse.stop()
  }
}
