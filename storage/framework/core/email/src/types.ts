export interface Message {
  name: string
  subject: string
  to: string
  from: string
  template: string
  handle?: () => Promise<{ message: string }> // is optional because it may be a simple template
  onError?: (error: Error) => { message: string }
}
