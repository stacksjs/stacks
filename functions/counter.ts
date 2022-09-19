// reactive state
const count = ref(0)
const date = useDateFormat(useNow(), 'YYYY-MM-DD HH:mm:ss')

// functions that mutate state and trigger updates
function increment() {
  // eslint-disable-next-line no-console
  console.log('the increment was run at', date)

  count.value++
}

export {
  count,
  increment,
}
