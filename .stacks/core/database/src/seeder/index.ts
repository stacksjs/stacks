// import { PrismaClient } from '@prisma/client'
import { Factory } from '../factory'

// const database = new PrismaClient()

function seeder(factoryName: any, count = 5) {
  return new Factory(factoryName).make(count)
}

export { seeder }
