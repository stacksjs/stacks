import { useToastStore } from '~/stores/toast'

export function useToast() {
  const toastStore = useToastStore()

  function success(param: { text: string; position?: string; duration?: number }) {
    toastStore.toggleToast(true)
    toastStore.setType('success')
    toastStore.setTitle(param.text)

    if (param.position)
      toastStore.setPosition(param.position)

    if (param.duration)
      toastStore.setDuration(param.duration)

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('success')
      }, param.duration || toastStore.duration) // wait for one second
    })
  }

  function error(param: { text: string; position?: string; duration?: number }) {
    toastStore.toggleToast(true)
    toastStore.setType('error')
    toastStore.setTitle(param.text)
    if (param.position)
      toastStore.setPosition(param.position)

    if (param.duration)
      toastStore.setDuration(param.duration)

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('success')
      }, param.duration || toastStore.duration) // wait for one second
    })
  }

  function warning(param: { text: string; position?: string; duration?: number }) {
    toastStore.toggleToast(true)
    toastStore.setType('warning')
    toastStore.setTitle(param.text)
    if (param.position)
      toastStore.setPosition(param.position)

    if (param.duration)
      toastStore.setDuration(param.duration)

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('success')
      }, param.duration || toastStore.duration) // wait for one second
    })
  }

  function info(param: { text: string; position?: string; duration?: number }) {
    toastStore.toggleToast(true)
    toastStore.setType('info')
    toastStore.setTitle(param.text)
    if (param.position)
      toastStore.setPosition(param.position)

    if (param.duration)
      toastStore.setDuration(param.duration)

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('success')
      }, param.duration || toastStore.duration) // wait for one second
    })
  }

  return { success, error, warning, info }
}
