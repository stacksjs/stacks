import type { ChargeOptions, CustomerOptions, DisputeOptions, EventOptions } from '@stacksjs/types'
import { isString } from '@stacksjs/utils'
import Stripe from 'stripe'
import services from '../../../../../config/services'

const apiKey = services?.stripe?.apiKey

if (!isString(apiKey)) {
  console.error('Stripe API key is not defined')
  process.exit(1)
}

const stripe = new Stripe(apiKey, {
  apiVersion: '2022-11-15',
})

const balance = async () => {
  return {
    retrieve: async () => {
      await stripe.balance.retrieve()
    },
  }
}

const balanceTransactions = async (txn: string, limit: number) => {
  return {
    retrieve: async () => {
      await stripe.balanceTransactions.retrieve(txn)
    },
    list: async () => {
      await stripe.balanceTransactions.list({
        limit,
      })
    },
  }
}

const dispute = async (options: DisputeOptions) => {
  return {
    retrieve: async () => {
      await stripe.disputes.retrieve(options.dp_id)
    },
    update: async () => {
      await stripe.disputes.update(
        options.dp_id,
        { ...options.metadata },
      )
    },
    close: async () => {
      await stripe.disputes.close(options.dp_id)
    },
    list: async () => {
      await stripe.disputes.list(options.listOptions)
    },
  }
}

const charge = async (amount: number, options?: ChargeOptions) => {
  return {
    create: async () => {
      await stripe.charges.create({
        amount,
        ...options,
      })
    },
    retrieve: async () => {
      await stripe.charges.retrieve(options?.chargeId)
    },
    update: async () => {
      await stripe.charges.update(
        options?.chargeId,
        { metadata: options?.metadata },
      )
    },
    capture: async () => {
      await stripe.charges.capture(options?.chargeId)
    },
    list: async () => {
      await stripe.charges.list({
        limit: options?.limit,
      })
    },
    search: async () => {
      await stripe.charges.search({
        ...options?.searchOptions,
      })
    },
  }
}

const customer = async (options: CustomerOptions) => {
  return {
    create: async () => {
      await stripe.customers.create(options)
    },
    retrieve: async () => {
      await stripe.customers.retrieve(options.address)
    },
    update: async () => {
      await stripe.customers.update(
        options.address,
        { ...options.metadata },
      )
    },
    delete: async () => {
      await stripe.customers.del(options.address)
    },
    list: async () => {
      await stripe.customers.list(options.listOptions)
    },
    search: async () => {
      await stripe.customers.search(options.searchOptions)
    },
  }
}

const events = async (options: EventOptions) => {
  return {
    retrieve: async () => {
      await stripe.events.retrieve(options.event_id)
    },
    list: async () => {
      await stripe.events.list(options.listOptions)
    },
  }
}

export {
  balance,
  balanceTransactions,
  charge,
  customer,
  dispute,
  events,
}
