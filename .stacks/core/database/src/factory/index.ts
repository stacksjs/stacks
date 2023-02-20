import { PrismaClient } from '@prisma/client'
import { ResultAsync } from '@stacksjs/error-handling'
import type { FactoryOptions } from '@stacksjs/types'
import { database } from '@stacksjs/config'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: database.url
    }
  }
});

const factory = (options: FactoryOptions) => {
  return {
    make: async () => {
      return ResultAsync.fromPromise(
        await prisma[options.name].createMany({
          data: options.items,
          skipDuplicates: true
        }),
        () => new Error('Failed to create the data'),
      )
    },

    create: async () => {
      return ResultAsync.fromPromise(
        await prisma[options.name].createMany({
          data: options.items,
          skipDuplicates: false
        }),
        () => new Error('Failed to create the data'),
      )
    },

  }
}

export { factory }
