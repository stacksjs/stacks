import type { Plugin } from 'vue'
import type { Action, ExternalToast, NotificationProps, ToastClasses, ToastT, ToastToDismiss } from './types'
import { Toaster as Notification, Toaster } from './components'
import { useNotification } from './composables/useNotification'
import { notification, toast } from './state'

export {
  type Action,
  type ExternalToast,
  Notification,
  notification,
  type NotificationProps,
  toast,
  type ToastClasses,
  Toaster,
  type ToastT,
  type ToastToDismiss,
  useNotification,
}

const plugin: Plugin = {
  install(app) {
    app.component('Notification', Notification)
  },
}

export default plugin
