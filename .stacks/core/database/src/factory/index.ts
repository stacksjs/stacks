import { PrismaClient } from '@prisma/client'
import { ResultAsync } from '@stacksjs/error-handling'
import type { FactoryOptions } from '@stacksjs/types'

const prisma = new PrismaClient()

const factory = (options: FactoryOptions) => {
  return {
    make: async () => {
      if (options.count)

      return ResultAsync.fromPromise(
        await prisma[options.name].createMany({
          data: options.items,
          skipDuplicates: true
        }),
        () => new Error('Failed to create the data'),
      )
    },

    create: async () => {
      if (options.count)

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
