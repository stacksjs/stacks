import { EmailOptions } from "stacks";

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
  metadata?: object;
  searchOptions: {
    query?: string;
    limit?: number;
  }
}

export interface CustomerOptions {
  description?: string;
  address?: string;
  email?: string;
  metadata?: object;
  name?: string;
  payment_method?: string;
  shipping: string;
}
