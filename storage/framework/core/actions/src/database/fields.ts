const fieldAssociation: { [key: string]: { [key: string]: string } } = {
  mysql: {
    string: 'varchar',
    enum: 'varchar',
    number: 'integer',
    boolean: 'boolean',
    text: 'text',
  },
  sqlite: {
    string: 'varchar',
    enum: 'varchar',
    number: 'integer',
    boolean: 'boolean',
    text: 'text',
  },
}

export { fieldAssociation }
