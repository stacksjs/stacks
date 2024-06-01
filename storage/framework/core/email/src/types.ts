export interface Message {
  name: string
  subject: string
  to: string
  from?: {
    name: string
    address: string
  }
  template: string
  handle?: () => Promise<{ message: string }> // optional because it may be a simple template
  onError?: (error: Error) => Promise<{ message: string }>
  onSuccess?: () => void
}

export interface SendEmailParams {
  Source: string
  Destination: {
    ToAddresses: string[]
  }
  Message: {
    Body: {
      Html: {
        Charset: 'UTF-8'
        Data: string
      }
    }
    Subject: {
      Charset: 'UTF-8'
      Data: string
    }
  }
}

export interface EmailParams {
  to: string
  from: string
  subject: string
  html: string
}
