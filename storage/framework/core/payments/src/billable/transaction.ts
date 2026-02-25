
type PaymentTransactionsTable = ModelRow<typeof PaymentTransaction>
import type { UserModel } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

export interface StoreTransactionOptions {
  brand: string
  provider_id: string
  description?: string
  type?: string
}

export interface ManageTransaction {
  store: (user: UserModel, productId: number, options: StoreTransactionOptions) => Promise<PaymentTransactionsTable | undefined>
  list: (user: UserModel) => Promise<PaymentTransactionsTable[]>
}

export const manageTransaction: ManageTransaction = (() => {
  async function store(user: UserModel, productId: number, options: StoreTransactionOptions): Promise<PaymentTransactionsTable | undefined> {
    const product = await db.selectFrom('payment_products').where('id', '=', productId).selectAll().executeTakeFirst()

    if (!product) {
      throw new Error(`Payment product with id ${productId} not found.`)
    }

    const data = {
      name: product.name,
      description: options.description ?? '',
      amount: product.unit_price,
      brand: options.brand,
      type: options.type ?? 'one-time',
      provider_id: options.provider_id,
      user_id: user.id,
    }

    const createdTransaction = await db.insertInto('payment_transactions').values(data).executeTakeFirst()

    const transaction = await db.selectFrom('payment_transactions').where('id', '=', Number(createdTransaction.insertId)).selectAll().executeTakeFirst()

    return transaction as unknown as PaymentTransactionsTable | undefined
  }

  async function list(user: UserModel): Promise<PaymentTransactionsTable[]> {
    const transaction = await db.selectFrom('payment_transactions').where('user_id', '=', user.id).selectAll().execute()

    return transaction as unknown as PaymentTransactionsTable[]
  }

  return { store, list }
})()
