type PrinterDriver = {
  print: (receipt: Receipt) => void
  cleanUp: () => void
  checkStatus: () => void
}

type Receipt = {
  id: string
  name: string
  price: number
  quantity: number
  image: string
}

const printer: PrinterDriver = {
  print(receipt: Receipt) {
    console.log(receipt)
  },

  cleanUp() {
    console.log('Cleaning up print job...')
  },

  checkStatus() {
    console.log('Checking online status...')
  },
}
