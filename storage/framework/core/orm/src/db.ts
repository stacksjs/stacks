import { db } from '@stacksjs/database'

export class DB {
  private static instance: any = null

  static setTransaction(transaction: any): void {
    this.instance = transaction
  }

  static clearTransaction(): void {
    this.instance = db
  }

  static get current(): any {
    if (!this.instance) {
      this.instance = db
    }

    return this.instance
  }
}
