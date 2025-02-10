import { DB } from './db'

export function transactionBuilder(callback: () => Promise<void>): Promise<void> {
  return DB.instance.transaction().execute(async (trx: any) => {
    DB.setTransaction(trx)
    try {
      return await callback()
    }
    finally {
      DB.clearTransaction()
    }
  })
}
