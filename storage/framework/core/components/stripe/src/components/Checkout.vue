<script>
import { StripeCheckout } from '@vue-stripe/vue-stripe'

export default {
  components: {
    StripeCheckout,
  },
  data() {
    this.publishableKey = 'abcd'
    return {
      loading: false,
      lineItems: [
        {
          price: 'abcd', // The id of the one-time price you created in your Stripe dashboard
          quantity: 1,
        },
      ],
      successURL: 'your-success-url',
      cancelURL: 'your-cancel-url',
    }
  },
  methods: {
    submit() {
      // You will be redirected to Stripe's secure checkout page
      this.$refs.checkoutRef.redirectToCheckout()
    },
  },
}
</script>

<template>
  <div>
    <StripeCheckout
      ref="checkoutRef"
      mode="payment"
      :pk="publishableKey"
      :line-items="lineItems"
      :success-url="successURL"
      :cancel-url="cancelURL"
      @loading="v => loading = v"
    />
    <button @click="submit">
      Pay now!
    </button>
  </div>
</template>
