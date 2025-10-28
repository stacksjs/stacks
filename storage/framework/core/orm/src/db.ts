import { db } from '@stacksjs/database'

export class DB {
  private static dbInstance: any = null

  static get instance(): DB | any {
    return this.dbInstance || db
  }

  static setTransaction(transaction: any): void {
    this.dbInstance = transaction
  }

  static clearTransaction(): void {
    this.dbInstance = db
  }
}
