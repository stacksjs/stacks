export const dynamodbClient = {
  // async createTable(tableName: string, callback: (table: Table) => void): Promise<void> {
  //   const table = new Table()
  //   callback(table)
  //   table.execute() // Simulate the execution of the table creation
  //   console.log(`Table "${tableName}" created.`)
  // },

  async dropTable(tableName: string): Promise<void> {
    console.log(`Table "${tableName}" dropped.`)
  },

  async find(id: number): Promise<any> {
    return { id }
  },
}
