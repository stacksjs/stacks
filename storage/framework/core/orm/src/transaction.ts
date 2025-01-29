import { DB } from './db'

export class TransactionBuilder {
  static async execute(callback: (trx: any) => Promise<any>): Promise<DB> {
    return await DB.current.transaction().execute(async (transaction: any) => {
      DB.setTransaction(transaction)

      try {
        const result = await callback(transaction)

        return result
      }
      finally {
        DB.clearTransaction()
      }
    })
  }
}
