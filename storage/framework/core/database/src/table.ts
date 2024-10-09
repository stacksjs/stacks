import { log } from '@stacksjs/logging'
import { Column } from './column'

export class Table {
  private columns: Column[] = []

  increments(name: string): Column {
    const column = new Column(name, 'integer', {
      primaryKey: true,
      autoIncrement: true,
    })
    this.columns.push(column)
    return column
  }

  string(name: string, varchar = 255): Column {
    const column = new Column(name, `varchar(${varchar})`)
    this.columns.push(column)
    return column
  }

  timestamps(): void {
    this.columns.push(new Column('created_at', 'timestamp'))
    this.columns.push(new Column('updated_at', 'timestamp'))
  }

  // Method to simulate the execution of the schema definition
  execute(): void {
    log.info(`Creating table with columns: ${this.columns.map(col => col.name).join(', ')}`)
    // run kysely mirgration
  }
}
