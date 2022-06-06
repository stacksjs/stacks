import { ref } from 'vue'

// reactive state
const count = ref(0)

// functions that mutate state and trigger updates
function increment() {
    count.value++
}

// lifecycle hooks
// onMounted(() => {
//   // eslint-disable-next-line no-console
//   console.log(`The initial count is ${count}.`)
// })

export {
  count,
  increment
}
