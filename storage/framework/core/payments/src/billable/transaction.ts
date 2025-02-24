import type { TransactionModel } from '../../../../orm/src/models/Transaction'
import type { UserModel } from '../../../../orm/src/models/User'
import Product from '../../../../orm/src/models/Product'
import { Transaction } from '../../../../orm/src/models/Transaction'

export interface ManageTransaction {
  store: (user: UserModel, productId: number) => Promise<TransactionModel>
  list: (user: UserModel) => Promise<TransactionModel[]>
}

export const manageTransaction: ManageTransaction = (() => {
  async function store(user: UserModel, productId: number): Promise<TransactionModel> {
    const product = await Product.find(productId)

    const data = {
      name: product?.name,
      description: '',
      amount: product?.unit_price,
      brand: 'visa',
      type: 'one-time',
      provider_id: '312321312',
      user_id: user.id,
    }

    const transaction = await Transaction.create(data)

    return transaction
  }

  async function list(user: UserModel): Promise<TransactionModel[]> {
    const transaction = await Transaction.where('user_id', user.id).get()

    return transaction
  }

  return { store, list }
})()
