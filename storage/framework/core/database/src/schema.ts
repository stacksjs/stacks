import { Table } from './table';

export class Schema {
  static async createTable(tableName: string, callback: (table: Table) => void): Promise<void> {
    const table = new Table()
    callback(table);
    table.execute(); // Simulate the execution of the table creation
    console.log(`Table "${tableName}" created.`);
  }
}
