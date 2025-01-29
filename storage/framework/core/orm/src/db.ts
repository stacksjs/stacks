import { db } from '@stacksjs/database'

export class DB {
  private static instance: any = db

  static setTransaction(transaction: any): void {
    this.instance = transaction
  }

  static clearTransaction(): void {
    this.instance = db
  }

  static get current(): any {
    return this.instance
  }
}
