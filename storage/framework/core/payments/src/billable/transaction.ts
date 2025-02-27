import type { PaymentTransactionModel } from '../../../../orm/src/models/PaymentTransaction'
import type { UserModel } from '../../../../orm/src/models/User'
import PaymentProduct from '../../../../orm/src/models/PaymentProduct'
import { PaymentTransaction } from '../../../../orm/src/models/PaymentTransaction'

export interface ManageTransaction {
  store: (user: UserModel, productId: number) => Promise<PaymentTransactionModel>
  list: (user: UserModel) => Promise<PaymentTransactionModel[]>
}

export const manageTransaction: ManageTransaction = (() => {
  async function store(user: UserModel, productId: number): Promise<PaymentTransactionModel> {
    const product = await PaymentProduct.find(productId)

    const data = {
      name: product?.name,
      description: '',
      amount: product?.unit_price,
      brand: 'visa',
      type: 'one-time',
      provider_id: '312321312',
      user_id: user.id,
    }

    const transaction = await PaymentTransaction.create(data)

    return transaction
  }

  async function list(user: UserModel): Promise<PaymentTransactionModel[]> {
    const transaction = await PaymentTransaction.where('user_id', user.id).get()

    return transaction
  }

  return { store, list }
})()
