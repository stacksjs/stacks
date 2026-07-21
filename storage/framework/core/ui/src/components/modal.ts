export {
  Dialog,
  DialogDescription,
  DialogPanel,
  DialogTitle,
} from '@stacksjs/components'

export interface ModalSnapshot<T = unknown> {
  open: boolean
  value?: T
}

export interface ModalController<T = unknown> {
  readonly snapshot: ModalSnapshot<T>
  open: (value?: T) => void
  close: () => void
  toggle: (value?: T) => void
  subscribe: (listener: (snapshot: ModalSnapshot<T>) => void) => () => void
}

export function createModal<T = unknown>(initialValue?: T): ModalController<T> {
  let snapshot: ModalSnapshot<T> = { open: false, value: initialValue }
  const listeners = new Set<(snapshot: ModalSnapshot<T>) => void>()

  function publish(next: ModalSnapshot<T>): void {
    snapshot = next
    for (const listener of listeners) listener(snapshot)
  }

  return {
    get snapshot() {
      return snapshot
    },
    open(value = snapshot.value) {
      publish({ open: true, value })
    },
    close() {
      publish({ ...snapshot, open: false })
    },
    toggle(value = snapshot.value) {
      publish({ open: !snapshot.open, value })
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot)
      return () => listeners.delete(listener)
    },
  }
}

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertValue {
  title: string
  description?: string
  tone?: AlertTone
}

export function createAlert(initialValue?: AlertValue): ModalController<AlertValue> {
  return createModal(initialValue)
}
