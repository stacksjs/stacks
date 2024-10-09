// reactive state
const count = ref(0)
const now = useDateFormat(useNow(), 'YYYY-MM-DD HH:mm:ss')

// functions that mutate state and trigger updates
function increment() {
  // eslint-disable-next-line no-console
  console.log('increment() was last run:', now)

  count.value++
}

export { count, increment }
