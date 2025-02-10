// wip
interface Printer {
  id: string | number
  name: string
  status: string
}

interface PrintJob {
  printer: Printer
  receipt: Receipt
}

interface PrinterDriver {
  print: (printJob: PrintJob) => Promise<void>
  cleanUp: (printer: Printer) => Promise<void>
  checkStatus: (printer: Printer) => Promise<boolean>
  findPrinters: () => Promise<Printer[]>
  setup: (printer: Printer) => Promise<void>
  restart: () => Promise<void>
  canInteractWithPrinter: (printer: Printer) => Promise<boolean>
}

type Path = string

interface Receipt {
  id: string | number
  name: string
  price: number
  quantity: number
  template: Path
}

class TSPIVPrinter implements PrinterDriver {
  async print(receipt: Receipt): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('TSP IV Printer: Printing receipt', receipt)
    // Implement actual printing logic here
  }

  async cleanUp(): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('TSP IV Printer: Cleaning up print job...')
    // Implement actual cleanup logic here
  }

  async checkStatus(): Promise<boolean> {
    // eslint-disable-next-line no-console
    console.log('TSP IV Printer: Checking online status...')
    // Implement actual status check logic here
    return true // Return actual status
  }
}

// Export the TSP IV printer instance
export const tspIVPrinter: PrinterDriver = new TSPIVPrinter()
