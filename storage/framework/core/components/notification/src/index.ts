import type { Plugin } from 'vue'
import { Toaster as Notification, Toaster } from './components'
import { useNotification } from './composables/useNotification'
import { notification, toast } from './state'
import type { Action, ExternalToast, NotificationProps, ToastClasses, ToastT, ToastToDismiss } from './types'

export {
  useNotification,
  Notification,
  Toaster,
  notification,
  toast,
  type NotificationProps,
  type ToastT,
  type ToastToDismiss,
  type Action,
  type ExternalToast,
  type ToastClasses,
}

const plugin: Plugin = {
  install(app) {
    app.component('Notification', Notification)
  },
}

export default plugin
