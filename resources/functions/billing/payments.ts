import { confirmCardSetup, confirmPayment, loadCardElement, loadPaymentElement } from '@stacksjs/browser'

const paymentStore = usePaymentStore()

export function useBillable() {
  function convertUnixTimestampToDate(timestamp: number): string {
    // Create a Date object from the Unix timestamp
    const date = new Date(timestamp * 1000) // Multiply by 1000 to convert to milliseconds

    // Define arrays for month names
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    // Extract day, month, and year
    const day = date.getDate()
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()

    // Return the formatted string in "Month Day, Year" format
    return `${month} ${day}, ${year}`
  }

  function formatTimestampDate(timestamp: string): string {
    const date = new Date(timestamp)

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    // Extract day, month, and year
    const day = date.getDate()
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()

    // Return the formatted string in "Month Day, Year" format
    return `${month} ${day}, ${year}`
  }

  async function loadCardForm(clientSecret: string): Promise<boolean> {
    const isCreated = await loadCardElement(clientSecret)

    return isCreated
  }

  async function loadPaymentForm(clientSecret: string): Promise<boolean> {
    const isCreated = await loadPaymentElement(clientSecret)

    return isCreated
  }

  async function handleAddPaymentMethod(clientSecret: string, elements: any) {
    try {
      const { error, setupIntent } = await confirmCardSetup(clientSecret, elements)

      if (error) {
        console.error(error.message)
      }
      else {
        await paymentStore.storePaymentMethod(setupIntent.payment_method)

        if (!paymentStore.hasPaymentMethods) {
          await paymentStore.setUserDefaultPaymentMethod(setupIntent.payment_method)
        }
      }
    }
    catch (err) {
      console.error('Error processing payment:', err)
      // Handle any unexpected errors
    }
  }

  async function handlePayment(elements: any) {
    try {
      await confirmPayment(elements)
    }
    catch (err) {
      console.error('Error processing payment:', err)
      // Handle any unexpected errors
    }
  }

  function isEmpty(object: any) {
    return !object // Checks for null or undefined
      || (typeof object === 'object'
        && Object.keys(object).length === 0)
  }

  const updatingPlanState = computed(() => {
    return !isEmpty(paymentStore.getCurrentPlan) && paymentStore.getPlanState
  })

  const showCurrentPlan = computed(() => {
    return !isEmpty(paymentStore.getCurrentPlan) && !paymentStore.getPlanState
  })

  const showPlans = computed(() => {
    return isEmpty(paymentStore.getCurrentPlan)
  })

  function editPlan() {
    paymentStore.openPlans()
  }

  function cancelEditPlan() {
    paymentStore.closePlans()
  }

  return {
    loadCardForm,
    loadPaymentForm,
    handleAddPaymentMethod,
    handlePayment,
    isEmpty,
    convertUnixTimestampToDate,
    formatTimestampDate,
    editPlan,
    updatingPlanState,
    showCurrentPlan,
    cancelEditPlan,
    showPlans,
  }
}
