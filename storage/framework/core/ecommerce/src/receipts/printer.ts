type Receipt = {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

const printer = {
  print(receipt: Receipt) {
    console.log(receipt)
  },

  cleanUpPrintJob() {
    console.log('Cleaning up print job...')
  },

  checkOnlineStatus() {
    console.log('Checking online status...')
  },
}
