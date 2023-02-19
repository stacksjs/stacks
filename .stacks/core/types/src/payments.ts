export interface PaymentOptions {
  drivers: {
    stripe: {
      key: string;
    }
  }
}

export interface ChargeOptions {
  currency?: string;
  source?: string;
  description?: string;
  chargeId?: string;
  limit?: number;
  metadata?: {
    order_id?: string
  },
  searchOptions: {
    query?: string;
    limit?: number;
  }
}
