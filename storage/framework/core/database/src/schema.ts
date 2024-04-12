import { log } from '@stacksjs/logging'
import { Table } from './table'

export const Schema = {
  async createTable(tableName: string, callback: (table: Table) => void): Promise<void> {
    const table = new Table()

    callback(table)

    table.execute() // Simulate the execution of the table creation

    log.success(`Table "${tableName}" created.`)
  },
}
