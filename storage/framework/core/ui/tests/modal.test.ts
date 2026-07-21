import { describe, expect, it } from 'bun:test'
import { createAlert, createModal } from '../src/components/modal'

describe('modal controller', () => {
  it('opens, toggles, and closes with typed payloads', () => {
    const modal = createModal<{ id: number }>()

    modal.open({ id: 42 })
    expect(modal.snapshot).toEqual({ open: true, value: { id: 42 } })

    modal.toggle()
    expect(modal.snapshot.open).toBe(false)

    modal.open()
    modal.close()
    expect(modal.snapshot).toEqual({ open: false, value: { id: 42 } })
  })

  it('notifies subscribers immediately and on changes', () => {
    const modal = createModal()
    const states: boolean[] = []
    const unsubscribe = modal.subscribe(snapshot => states.push(snapshot.open))

    modal.open()
    unsubscribe()
    modal.close()

    expect(states).toEqual([false, true])
  })

  it('uses the same reusable controller for alerts', () => {
    const alert = createAlert()
    alert.open({ title: 'Saved', tone: 'success' })

    expect(alert.snapshot.value).toEqual({ title: 'Saved', tone: 'success' })
  })
})
