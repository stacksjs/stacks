import { z as validate, z } from 'zod'

enum Type {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Object = 'Object',
  Array = 'Array',
}

export { validate, z, Type }
