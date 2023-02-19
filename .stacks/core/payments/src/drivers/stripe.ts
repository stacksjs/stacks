import { payment as config } from '@stacksjs/config'
import type { ChargeOptions, CustomerOptions } from '@stacksjs/types'

const stripe = require('stripe')(config.drivers.stripe.key);

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
        limit: limit,
      })
    },
  }
}

const dispute = async (txn: string) => {
  return {
    retrieve: async () => {
      await stripe.disputes.retrieve(txn)
    }
  }
}

const charge = async (amount: number, options?: ChargeOptions) => {
  return {
    create: async () => {
      await stripe.charges.create({
        amount: amount,
        ...options
      })
    },
    retrieve: async () => {
      await stripe.charges.retrieve(options?.chargeId)
    },
    update: async () => {
      await stripe.charges.update(
        options?.chargeId,
        { metadata: options?.metadata }
      )
    },
    capture: async () => {
      await stripe.charges.capture(options?.chargeId)
    },
    list: async () => {
      await stripe.charges.list({
        limit: options?.limit,
      });
    },
    search: async () => {
      await stripe.charges.search({
        ...options?.searchOptions
      });
    }
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
        { ...options.metadata }
      )
    }
  }
}
const events = async (event_key: string) => {
  return await stripe.events.retrieve(event_key);
}

export {
  balance,
  balanceTransactions,
  events,
  charge,
  dispute
}
