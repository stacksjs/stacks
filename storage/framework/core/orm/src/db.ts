import { db } from '@stacksjs/database'

export class DB {
  private static dbInstance: any = null

  static get instance(): DB | any {
    if (!this.dbInstance) {
      this.dbInstance = db
    }

    return this.dbInstance
  }

  static setTransaction(transaction: any): void {
    this.dbInstance = transaction
  }

  static clearTransaction(): void {
    this.dbInstance = db
  }
}
