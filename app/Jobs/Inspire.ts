import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

const quotes = [
  'Simplicity is the ultimate sophistication. — Leonardo da Vinci',
  'The best way to predict the future is to invent it. — Alan Kay',
  'Code is like humor. When you have to explain it, it\'s bad. — Cory House',
  'First, solve the problem. Then, write the code. — John Johnson',
  'Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler',
  'The only way to do great work is to love what you do. — Steve Jobs',
  'Talk is cheap. Show me the code. — Linus Torvalds',
  'Make it work, make it right, make it fast. — Kent Beck',
]

export default new Job({
  name: 'Inspire',
  description: 'A demo job that logs an inspirational quote',
  queue: 'default',
  tries: 3,
  backoff: 3,
  rate: Every.Hour,

  handle: () => {
    const quote = quotes[Math.floor(Math.random() * quotes.length)]
    console.log(`\n  ✨ ${quote}\n`)
    return { quote }
  },
})
