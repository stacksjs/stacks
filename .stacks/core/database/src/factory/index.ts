import { PrismaClient } from '@prisma/client'
import { ResultAsync } from '@stacksjs/errors'

const prisma = new PrismaClient()

class Factory {
    private factory: string
    private noOfItems = 5
    private items = []
    private columns = []

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

    async make(count = 0) {
        if (count) {
            this.noOfItems = count
        }

        this.intiateColumns()

        return ResultAsync.fromPromise(
            await prisma[this.factory].createMany(
                this.items,
                true
            ),
            () => new Error(`Failed to create the data`)
        )
    }

    async create(count = 0) {
        if (count) {
            this.noOfItems = count
        }

        this.intiateColumns()

        return ResultAsync.fromPromise(
            await prisma[this.factory].createMany(
                this.items,
                false
            ),
            () => new Error(`Failed to create the data`)
        )
    }
    
    intiateColumns() {
        for (let i = 0; i < this.noOfItems; i++) {
            this.items.push(this.columns)
        }
    }
}


export { Factory as factory, Factory }
