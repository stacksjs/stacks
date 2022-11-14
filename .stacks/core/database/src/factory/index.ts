import { PrismaClient } from '@prisma/client'
import { ResultAsync } from '@stacksjs/errors'
import type { Result } from '@stacksjs/types'

const prisma = new PrismaClient()

class Factory {
  private factory: string
  private noOfItems = 5
  private items: Array<Object> = []
  private columns: Array<Object> = []

  constructor(factory: string) {
    this.factory = factory
  }

  define(params: any) {
    this.columns = params
    return this
  }

  count(count = 5) {
    this.noOfItems = count
    return this
  }

  async make(count = 0): Promise<Result<Object, Error>> {
    if (count)
      this.noOfItems = count

    this.initiateColumns()

    return ResultAsync.fromPromise(
      await prisma[this.factory].createMany(
        this.items,
        true,
      ),
      () => new Error('Failed to create the data'),
    )
  }

  async create(count = 0): Promise<Result<Object, Error>> {
    if (count)
      this.noOfItems = count

    this.initiateColumns()

    return ResultAsync.fromPromise(
      await prisma[this.factory].createMany(
        this.items,
        false,
      ),
      () => new Error('Failed to create the data'),
    )
  }

  initiateColumns() {
    for (let i = 0; i < this.noOfItems; i++)
      this.items.push(this.columns)
  }
}

export { Factory as factory, Factory }
