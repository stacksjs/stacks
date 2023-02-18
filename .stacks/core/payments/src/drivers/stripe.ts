import { payment as config } from '@stacksjs/config'

const stripe = require('stripe')(config.drivers.stripe.key);

const balance = async () => {
  return await stripe.balance.retrieve()
}

const balanceTransactions = async (txn: string) => {
  return await stripe.balanceTransactions.retrieve(txn)
}

const dispute = async (txn: string) => {
  return await stripe.disputes.retrieve(txn);
}

const charge = async (amount: number, options?: object) => {
  await stripe.charges.create({
    amount: amount,
    ...options
  });
}

export {
  balance,
  balanceTransactions,
  charge,
  dispute
}
