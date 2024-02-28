import { Column } from './column'

export class Table {
  private columns: Column[] = [];

  increments(name: string): Column {
    const column = new Column(name, 'integer', { primaryKey: true, autoIncrement: true });
    this.columns.push(column);
    return column;
  }

  string(name: string): Column {
    const column = new Column(name, 'varchar(255)');
    this.columns.push(column);
    return column;
  }

  timestamps(): void {
    this.columns.push(new Column('created_at', 'timestamp'));
    this.columns.push(new Column('updated_at', 'timestamp'));
  }

  // Method to simulate the execution of the schema definition
  execute(): void {
    console.log(`Creating table with columns: ${this.columns.map(col => col.name).join(', ')}`);
    // Here you would normally execute the SQL commands to create the table and columns in the database
  }
}
