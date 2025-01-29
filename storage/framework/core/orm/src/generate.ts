import type {
  Model,
  ModelElement,
} from '@stacksjs/types'
import { camelCase, pascalCase, plural, singular, snakeCase } from '@stacksjs/strings'
import { fetchOtherModelRelations, getFillableAttributes, getGuardedAttributes, getHiddenAttributes, getRelationCount, getRelations, getRelationType, mapEntity } from './utils'

export async function generateModelString(
  tableName: string,
  modelName: string,
  model: Model,
  attributes: ModelElement[],
): Promise<string> {
  const formattedTableName = pascalCase(tableName) // users -> Users
  const formattedModelName = modelName.toLowerCase() // User -> user

  let relationStringThisBelong = ''

  let relationStringThisMany = ''

  let instanceSoftDeleteStatements = ''
  let instanceSoftDeleteStatementsSelectFrom = ''
  let instanceSoftDeleteStatementsUpdateFrom = ''
  let thisSoftDeleteStatementsUpdateFrom = ''

  let fieldString = ''
  let constructorFields = ''
  let jsonFields = '{\n'
  let jsonRelations = ''
  let declareFields = ''
  let uuidQuery = ''
  let uuidQueryMany = ''
  let whereStatements = ''
  let whereFunctionStatements = ''
  let relationMethods = ''
  let relationImports = ''
  let paymentImports = ''
  let twoFactorStatements = ''
  let billableStatements = ''
  let displayableStatements = ''
  let removeInstanceStatment = ''
  let mittCreateStatement = ''
  let mittUpdateStatement = ''
  let mittDeleteStatement = ''
  let mittDeleteStaticFindStatement = ''
  let mittDeleteFindStatement = ''
  let privateSoftDeletes = ''

  const relations = await getRelations(model, modelName)

  for (const relationInstance of relations) {
    relationImports += `import ${relationInstance.model} from './${relationInstance.model}'\n\n`
    relationImports += `import type {${relationInstance.model}Model} from './${relationInstance.model}'\n\n`
  }

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
  const observer = model?.traits?.observe
  const useUuid = model?.traits?.useUuid || false

  if (useUuid) {
    uuidQuery += `filteredValues['uuid'] = randomUUIDv7()`
    uuidQueryMany += `
          filteredValues.forEach(model => {
            model.uuid = randomUUIDv7()
          })
       `
  }

  if (useSoftDeletes) {
    privateSoftDeletes = `private softDeletes = false`
    instanceSoftDeleteStatements += `if (instance.softDeletes) {
        query = query.where('deleted_at', 'is', null)
      }`

    instanceSoftDeleteStatementsSelectFrom += ` if (instance.softDeletes) {
        instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
      }`

    instanceSoftDeleteStatementsUpdateFrom += `
        const instance = new ${modelName}Model(null)
  
        if (instance.softDeletes) {
          return await db.updateTable('${tableName}')
          .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP'),
          })
          .where('id', '=', id)
          .execute()
        }
      `

    thisSoftDeleteStatementsUpdateFrom += `if (this.softDeletes) {
        return await db.updateTable('${tableName}')
        .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP')
        })
        .where('id', '=', this.id)
        .execute()
      }`
  }

  if (typeof observer === 'boolean') {
    if (observer) {
      removeInstanceStatment += `const instance = new ${modelName}Model(null)`
      mittCreateStatement += `if (model)\n dispatch('${formattedModelName}:created', model)`
      mittUpdateStatement += `if (model)\n dispatch('${formattedModelName}:updated', model)`
      mittDeleteStatement += `if (model)\n dispatch('${formattedModelName}:deleted', model)`

      mittDeleteStaticFindStatement += 'const model = await instance.find(Number(id))'
      mittDeleteFindStatement += 'const model = await this.find(Number(this.id))'
    }
  }

  if (Array.isArray(observer)) {
    removeInstanceStatment += `const instance = new ${modelName}Model(null)`
    // Iterate through the array and append statements based on its contents
    if (observer.includes('create')) {
      mittCreateStatement += `if (model)\n dispatch('${formattedModelName}:created', model);`
    }
    if (observer.includes('update')) {
      mittUpdateStatement += `if (model)\n dispatch('${formattedModelName}:updated', model);`
    }
    if (observer.includes('delete')) {
      mittDeleteStaticFindStatement += 'const model = await instance.find(id)'
      mittDeleteStatement += `if (model)\n dispatch('${formattedModelName}:deleted', model);`
    }
  }

  for (const relation of relations) {
    const modelRelation = relation.model
    const foreignKeyRelation = relation.foreignKey
    const modelKeyRelation = relation.modelKey
    const tableRelation = relation.table || ''
    const pivotTableRelation = relation.pivotTable
    const formattedModelRelation = camelCase(modelRelation)
    const relationType = getRelationType(relation.relationship)
    const relationCount = getRelationCount(relation.relationship)

    if (relationType === 'throughType') {
      const relationName = relation.relationName || formattedModelName + modelRelation
      const throughRelation = relation.throughModel

      if (relation.throughModel === undefined)
        continue

      const formattedThroughRelation = relation?.throughModel?.toLowerCase()
      const throughTableRelation = throughRelation
      const foreignKeyThroughRelation = relation.throughForeignKey || `${formattedThroughRelation}_id`

      relationMethods += `
        async ${relationName}() {
          if (this.id === undefined)
            throw new HttpError(500, 'Relation Error!')
  
          const firstModel = await db.selectFrom('${throughTableRelation}')
            .where('${foreignKeyRelation}', '=', this.id)
            .selectAll()
            .executeTakeFirst()
  
          if (! firstModel)
            throw new HttpError(500, 'Model Relation Not Found!')
  
          const finalModel = ${modelRelation}
            .where('${foreignKeyThroughRelation}', '=', firstModel.id)
            .first()
  
          return new ${modelRelation}.modelInstance(finalModel)
        }\n\n`
    }

    if (relationType === 'hasType' && relationCount === 'many') {
      const relationName = camelCase(relation.relationName || tableRelation)

      declareFields += `public ${snakeCase(relationName)}: ${modelRelation}Model[] | undefined\n`
      constructorFields += `this.${snakeCase(relationName)} = ${formattedModelName}?.${snakeCase(relationName)}\n`
      fieldString += `${snakeCase(relationName)}?: ${modelRelation}Model[] | undefined\n`

      relationStringThisMany += `
          if (this.withRelations.includes('${snakeCase(relationName)}')) {
            model.${snakeCase(relationName)} = await this.${relationName}HasMany()\n
          }
        `
      jsonRelations += `${snakeCase(relationName)}: this.${snakeCase(relationName)},\n`

      relationMethods += `
        async ${relationName}HasMany(): Promise<${modelRelation}Model[]> {
          if (this.id === undefined)
            throw new HttpError(500, 'Relation Error!')
          
          const results = await db.selectFrom('${tableRelation}')
            .where('${foreignKeyRelation}', '=', this.id)
            .limit(5)
            .selectAll()
            .execute()
  
            return results.map((modelItem) => new ${modelRelation}(modelItem))
        }\n\n`
    }

    if (relationType === 'hasType' && relationCount === 'one') {
      const relationName = relation.relationName || formattedModelRelation
      relationMethods += `
        async ${relationName}() {
          if (this.id === undefined)
             throw new HttpError(500, 'Relation Error!')
  
          const model = ${modelRelation}
          .where('${foreignKeyRelation}', '=', this.id).first()
  
          if (! model)
            throw new HttpError(500, 'Model Relation Not Found!')
  
          return model
        }\n\n`
    }

    if (relationType === 'belongsType' && !relationCount) {
      const relationName = camelCase(relation.relationName || formattedModelRelation)

      fieldString += ` ${relation.modelKey}?: number \n`
      declareFields += `public ${relation.modelKey}: number | undefined \n   `
      constructorFields += `this.${relation.modelKey} = ${formattedModelName}?.${relation.modelKey}\n   `
      jsonRelations += `${relation.modelKey}: this.${relation.modelKey},\n   `

      declareFields += `public ${snakeCase(relationName)}: ${modelRelation}Model | undefined\n`
      constructorFields += `this.${snakeCase(relationName)} = ${formattedModelName}?.${snakeCase(relationName)}\n`
      fieldString += `${snakeCase(relationName)}?: ${modelRelation}Model\n`

      relationStringThisBelong += `
          if (this.withRelations.includes('${snakeCase(relationName)}')) {
            model.${snakeCase(relationName)} = await this.${relationName}Belong()\n
          }
        `
      jsonRelations += `${snakeCase(relationName)}: this.${snakeCase(relationName)},\n`

      relationMethods += `
        async ${relationName}Belong(): Promise<${modelRelation}Model> {
          if (this.${modelKeyRelation} === undefined)
            throw new HttpError(500, 'Relation Error!')
  
          const model = await ${modelRelation}
            .where('id', '=', this.${modelKeyRelation})
            .first()
  
          if (! model)
            throw new HttpError(500, 'Model Relation Not Found!')
  
          return model
        }\n\n`
    }

    if (relationType === 'belongsType' && relationCount === 'many') {
      const pivotTable = pivotTableRelation || tableRelation
      const pivotKey = relation.pivotKey || tableRelation
      const relationName = relation.relationName || formattedModelName + plural(pascalCase(modelRelation))

      relationMethods += `
        async ${relationName}() {
          if (this.id === undefined)
            throw new HttpError(500, 'Relation Error!')
  
          const results = await db.selectFrom('${pivotTable}')
            .where('${pivotKey}', '=', this.id)
            .selectAll()
            .execute()
  
            const tableRelationIds = results.map(result => result.${singular(tableRelation)}_id)
  
            if (! tableRelationIds.length)
              throw new HttpError(500, 'Relation Error!')
  
            const relationResults = await ${modelRelation}.whereIn('id', tableRelationIds).get()
  
            return relationResults
        }\n\n`
    }
  }

  declareFields += `public id: number | undefined \n   `

  constructorFields += `this.id = ${formattedModelName}?.id || 1\n   `

  const useTwoFactor = typeof model.traits?.useAuth === 'object' && model.traits.useAuth.useTwoFactor
  const usePasskey = typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey
  const useBillable = model.traits?.billable || false
  const useSearchable = model.traits?.useSearch || false
  const displayableAttributes = typeof model.traits?.useSearch === 'object' && model.traits?.useSearch.displayable

  if (typeof useSearchable === 'object' && useSearchable) {
    const searchAttrs = Array.isArray(displayableAttributes) ? displayableAttributes : []

    displayableStatements += `
          toSearchableObject(): Partial<${formattedTableName}Table> {
              return {
                  ${searchAttrs
                    .map(attr => `${attr}: this.${attr}`)
                    .join(',\n')}
              }
          }
      `
  }

  if (useBillable) {
    paymentImports += `import { PaymentMethodModel } from './PaymentMethod'\n`
    paymentImports += `import { TransactionModel } from './Transaction'`

    billableStatements += ` async createStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      const customer = await manageCustomer.createStripeCustomer(this, options)
  
        return customer
      }
  
      async updateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
        const customer = await manageCustomer.updateStripeCustomer(this, options)
  
        return customer
      }
  
      async storeTransaction(productId: number): Promise<TransactionModel> {
        const transaction = await manageTransaction.store(this, productId)
  
        return transaction
      }
  
      async deleteStripeUser(): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
        const deletedCustomer = await manageCustomer.deleteStripeUser(this)
        return deletedCustomer
      }
  
      async createOrGetStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
        const customer = await manageCustomer.createOrGetStripeUser(this, options)
        return customer
      }
  
      async retrieveStripeUser(): Promise<Stripe.Response<Stripe.Customer> | undefined> {
        const customer = await manageCustomer.retrieveStripeUser(this)
        return customer
      }
  
       async defaultPaymentMethod(): Promise<PaymentMethodModel | undefined> {
        const defaultPaymentMethod = await managePaymentMethod.retrieveDefaultPaymentMethod(this)
  
        return defaultPaymentMethod
      }
  
      async setDefaultPaymentMethod(pmId: number): Promise<Stripe.Response<Stripe.Customer>> {
        const updatedCustomer = await managePaymentMethod.setDefaultPaymentMethod(this, pmId)
      
        return updatedCustomer
      }
  
      async setUserDefaultPaymentMethod(paymentMethodId: string): Promise<Stripe.Response<Stripe.Customer>> {
        const updatedCustomer = await managePaymentMethod.setUserDefaultPayment(this, paymentMethodId)
      
        return updatedCustomer
      }
  
      async updateDefaultPaymentMethod(paymentMethodId: number): Promise<Stripe.Response<Stripe.Customer>> {
        const updatedCustomer = this.setDefaultPaymentMethod(paymentMethodId)
  
        return updatedCustomer
      }
  
      async asStripeUser(): Promise<Stripe.Response<Stripe.Customer> | undefined> {
        return await this.retrieveStripeUser()
      }
  
      async createOrUpdateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
        const customer = await manageCustomer.createOrUpdateStripeUser(this, options)
        return customer
      }
  
      stripeId(): string {
        return manageCustomer.stripeId(this)
      }
  
      hasStripeId(): boolean {
        return manageCustomer.hasStripeId(this)
      }
  
      async addPaymentMethod(paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
        const paymentMethod = await managePaymentMethod.addPaymentMethod(this, paymentMethodId)
  
        return paymentMethod
      }
  
      async updatePaymentMethod(paymentMethodId: string, params?: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
        const updatedPaymentMethod = await managePaymentMethod.updatePaymentMethod(this, paymentMethodId, params)
  
        return updatedPaymentMethod
      }
  
      async deletePaymentMethod(paymentMethodId: number): Promise<Stripe.Response<Stripe.PaymentMethod>> {
        const deletedPaymentMethod = await managePaymentMethod.deletePaymentMethod(this, paymentMethodId)
        return deletedPaymentMethod
      }
  
      async retrievePaymentMethod(paymentMethod: number): Promise<PaymentMethodModel | undefined> {
        const defaultPaymentMethod = await managePaymentMethod.retrievePaymentMethod(this, paymentMethod)
  
        return defaultPaymentMethod
      }
  
      async paymentIntent(options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
        if (!this.hasStripeId()) {
          throw new HttpError(404, 'Customer does not exist in Stripe')
        }
  
        const defaultOptions: Stripe.PaymentIntentCreateParams = {
          customer: this.stripeId(),
          currency: 'usd',
          amount: options.amount
        }
  
        const mergedOptions = { ...defaultOptions, ...options }
  
        return await manageCharge.createPayment(this, mergedOptions.amount, mergedOptions)
      }
  
      async syncStripeCustomerDetails(options: StripeCustomerOptions): Promise<Stripe.Response<Stripe.Customer>> {
        const customer = await manageCustomer.syncStripeCustomerDetails(this, options)
  
        return customer
      }
  
      async subscriptionHistory(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
        return manageInvoice.list(this)
      }
  
      async transactionHistory(): Promise<TransactionModel[]> {
        return manageTransaction.list(this)
      }
  
      async stripeSubscriptions(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
        return manageInvoice.list(this)
      }
  
      async activeSubscription() {
        const subscription = await db.selectFrom('subscriptions')
          .where('user_id', '=', this.id)
          .where('provider_status', '=', 'active')
          .selectAll()
          .executeTakeFirst()
  
        if (subscription) {
          const providerSubscription = await manageSubscription.retrieve(this, subscription?.provider_id || '')
  
          return { subscription, providerSubscription }
        }
  
        return undefined
      }
  
      async isIncomplete(type: string): Promise<boolean> {
        return await manageSubscription.isIncomplete(this, type)
      }
      
      async paymentMethods(cardType?: string): Promise<PaymentMethodModel[]> {
        return await managePaymentMethod.listPaymentMethods(this, cardType)
      }
        
      async newSubscriptionInvoice(
        type: string,
        lookupKey: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
      ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
        return await this.newSubscription(type, lookupKey, { ...options, days_until_due: 15, collection_method: 'send_invoice' })
      }
  
      async newSubscription(
        type: string,
        lookupKey: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
      ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
        const subscription = await manageSubscription.create(this, type, lookupKey, options)
  
        const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
        const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | undefined
  
        return { subscription, paymentIntent }
      }
      
      async updateSubscription(
        type: string,
        lookupKey: string,
        options: Partial<Stripe.SubscriptionUpdateParams> = {},
      ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
        const subscription = await manageSubscription.update(this, type, lookupKey, options)
  
        const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
        const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | undefined
  
        return { subscription, paymentIntent }
      }
  
      async cancelSubscription(
        providerId: string,
        options: Partial<Stripe.SubscriptionCreateParams> = {},
      ): Promise<{ subscription: Stripe.Subscription, paymentIntent?: Stripe.PaymentIntent }> {
        const subscription = await manageSubscription.cancel(providerId, options)
  
        return { subscription }
      }
  
      async createSetupIntent(
        options: Stripe.SetupIntentCreateParams = {}
      ): Promise<Stripe.Response<Stripe.SetupIntent>> {
        const defaultOptions: Partial<Stripe.SetupIntentCreateParams> = {
          metadata: options.metadata,
        }
      
        // Merge any additional provided options
        const mergedOptions = { ...defaultOptions, ...options }
      
        // Call Stripe to create the SetupIntent
        return await manageSetupIntent.create(this, mergedOptions)
      }
  
      async checkout(
        priceIds: CheckoutLineItem[],
        options: CheckoutOptions = {},
      ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
        const newOptions: Partial<Stripe.Checkout.SessionCreateParams> = {}
  
        if (options.enableTax) {
          newOptions.automatic_tax = { enabled: true }
          delete options.enableTax
        }
  
        if (options.allowPromotions) {
          newOptions.allow_promotion_codes = true
          delete options.allowPromotions
        }
  
        const defaultOptions: Partial<Stripe.Checkout.SessionCreateParams> = {
          mode: 'payment',
          customer: await this.createOrGetStripeUser({}).then(customer => customer.id),
          line_items: priceIds.map((item: CheckoutLineItem) => ({
            price: item.priceId,
            quantity: item.quantity || 1,
          })),
  
        }
  
        const mergedOptions = { ...defaultOptions, ...newOptions, ...options }
  
        return await manageCheckout.create(this, mergedOptions)
      }
      `

    declareFields += `public stripe_id: string | undefined\n`

    constructorFields += `this.stripe_id = ${formattedModelName}?.stripe_id\n   `
  }

  if (useTwoFactor) {
    declareFields += `public two_factor_secret: string | undefined \n`
    constructorFields += `this.two_factor_secret = ${formattedModelName}?.two_factor_secret\n   `

    twoFactorStatements += `
        async generateTwoFactorForModel() {
          const secret = generateTwoFactorSecret()
  
          await this.update({ 'two_factor_secret': secret })
        }
  
        verifyTwoFactorCode(code: string): boolean {
          const modelTwoFactorSecret = this.two_factor_secret
          let isValid = false
  
          if (typeof modelTwoFactorSecret === 'string') {
            isValid = verifyTwoFactorCode(code, modelTwoFactorSecret)
          }
  
          return isValid
        }
      `
  }

  if (useUuid) {
    declareFields += 'public uuid: string | undefined \n'
    constructorFields += `this.uuid = ${formattedModelName}?.uuid\n   `
  }

  if (usePasskey) {
    declareFields += 'public public_passkey: string | undefined \n'
    constructorFields += `this.public_passkey = ${formattedModelName}?.public_passkey\n   `
  }

  jsonFields += '\nid: this.id,\n'
  for (const attribute of attributes) {
    const entity = mapEntity(attribute)

    fieldString += ` ${snakeCase(attribute.field)}?: ${entity}\n     `
    declareFields += `public ${snakeCase(attribute.field)}: ${entity} | undefined \n   `
    constructorFields += `this.${snakeCase(attribute.field)} = ${formattedModelName}?.${snakeCase(attribute.field)}\n   `
    jsonFields += `${snakeCase(attribute.field)}: this.${snakeCase(attribute.field)},\n   `

    whereStatements += `static where${pascalCase(attribute.field)}(value: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.where('${attribute.field}', '=', value)
  
          return instance
        } \n\n`

    whereFunctionStatements += `export async function where${pascalCase(attribute.field)}(value: ${entity}): Promise<${modelName}Model[]> {
          const query = db.selectFrom('${tableName}').where('${snakeCase(attribute.field)}', '=', value)
          const results = await query.execute()
  
          return results.map(modelItem => new ${modelName}Model(modelItem))
        } \n\n`
  }

  if (useTimestamps) {
    declareFields += `
        public created_at: Date | undefined
        public updated_at: Date | undefined
      `

    constructorFields += `
        this.created_at = ${formattedModelName}?.created_at\n
        this.updated_at = ${formattedModelName}?.updated_at\n
      `

    jsonFields += `
        created_at: this.created_at,\n
        updated_at: this.updated_at,\n
      `
  }

  if (useSoftDeletes) {
    declareFields += `
        public deleted_at: Date | undefined
      `

    constructorFields += `
        this.deleted_at = ${formattedModelName}?.deleted_at\n
      `

    jsonFields += `
        deleted_at: this.deleted_at,\n
      `
  }

  jsonFields += jsonRelations
  jsonFields += `...this.customColumns,\n`
  jsonFields += '}'

  const otherModelRelations = await fetchOtherModelRelations(modelName)

  if (useTwoFactor && tableName === 'users')
    fieldString += 'two_factor_secret?: string \n'

  if (usePasskey && tableName === 'users')
    fieldString += 'public_passkey?: string \n'

  if (useBillable && tableName === 'users')
    fieldString += 'stripe_id?: string \n'

  if (useUuid)
    fieldString += 'uuid?: string \n'

  if (useTimestamps) {
    fieldString += `
        created_at?: Date\n
        updated_at?: Date
      `
  }

  if (useSoftDeletes) {
    fieldString += `
        deleted_at?: Date
      `
  }

  const hidden = JSON.stringify(getHiddenAttributes(model.attributes))
  const fillable = JSON.stringify(getFillableAttributes(model, otherModelRelations))
  const guarded = JSON.stringify(getGuardedAttributes(model))

  return `import type { Generated, Insertable, RawBuilder, Selectable, Updateable, Sql} from '@stacksjs/database'
      import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSubscription, manageTransaction, managePrice, manageSetupIntent, type Stripe } from '@stacksjs/payments'
      import { db, sql } from '@stacksjs/database'
      import { DB, SubqueryBuilder } from '@stacksjs/orm'
      import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
      import { HttpError, ModelNotFoundException } from '@stacksjs/error-handling'
      import { dispatch } from '@stacksjs/events'
      import { generateTwoFactorSecret } from '@stacksjs/auth'
      import { verifyTwoFactorCode } from '@stacksjs/auth'
      import { cache } from '@stacksjs/cache'
      import { randomUUIDv7 } from 'bun'
      ${paymentImports}
      ${relationImports}
  
      export interface ${formattedTableName}Table {
        id?: number
       ${fieldString}
      }
  
      interface ${modelName}Response {
        data: ${modelName}JsonResponse[]
        paging: {
          total_records: number
          page: number
          total_pages: number
        }
        next_cursor: number | null
      }

      export interface ${modelName}JsonResponse extends Omit<${formattedTableName}Table, 'password'> {
        [key: string]: any
      }
        
      export type ${modelName}Type = Selectable<${formattedTableName}Table>
      export type New${modelName} = Partial<Insertable<${formattedTableName}Table>>
      export type ${modelName}Update = Updateable<${formattedTableName}Table>
  
      type SortDirection = 'asc' | 'desc'
      interface SortOptions { column: ${modelName}Type, order: SortDirection }
      // Define a type for the options parameter
      interface QueryOptions {
        sort?: SortOptions
        limit?: number
        offset?: number
        page?: number
      }
  
      export class ${modelName}Model {
        private readonly hidden: Array<keyof ${modelName}JsonResponse> = ${hidden}
        private readonly fillable: Array<keyof ${modelName}JsonResponse> = ${fillable}
        private readonly guarded: Array<keyof ${modelName}JsonResponse> = ${guarded}
        ${privateSoftDeletes}
        protected selectFromQuery: any
        protected withRelations: string[]
        protected updateFromQuery: any
        protected deleteFromQuery: any
        protected hasSelect: boolean
        private customColumns: Record<string, unknown> = {}
        ${declareFields}
        constructor(${formattedModelName}: Partial<${modelName}Type> | null) {
          if (${formattedModelName}) {
            ${constructorFields}

            Object.keys(${formattedModelName}).forEach(key => {
              if (!(key in this)) {
                 this.customColumns[key] = (${formattedModelName} as ${modelName}JsonResponse)[key]
              }
            })
          }
  
          this.withRelations = []
          this.selectFromQuery = DB.instance.selectFrom('${tableName}')
          this.updateFromQuery = db.updateTable('${tableName}')
          this.deleteFromQuery = db.deleteFrom('${tableName}')
          this.hasSelect = false
        }
  
        select(params: (keyof ${modelName}Type)[] | RawBuilder<string> | string): ${modelName}Model {
          return ${modelName}Model.select(params)
        }

        static select(params: (keyof ${modelName}Type)[] | RawBuilder<string> | string): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          // Initialize a query with the table name and selected fields
          instance.selectFromQuery = instance.selectFromQuery.select(params)
  
          instance.hasSelect = true
  
          return instance
        }
  
        async find(id: number): Promise<${modelName}Model | undefined> {
          return await ${modelName}Model.find(id)
        }

        // Method to find a ${modelName} by ID
        static async find(id: number): Promise<${modelName}Model | undefined> {
          const model = await db.selectFrom('${tableName}').where('id', '=', id).selectAll().executeTakeFirst()
  
          if (!model)
            return undefined
          
          const instance = new ${modelName}Model(null)
  
          const result = await instance.mapWith(model)
  
          const data = new ${modelName}Model(result as ${modelName}Type)
  
          cache.getOrSet(\`${formattedModelName}:\${id}\`, JSON.stringify(model))
  
          return data
        }

        async first(): Promise<${modelName}Model | undefined> {
          return await ${modelName}Model.first()
        }
        
        static async first(): Promise<${modelName}Model | undefined> {
          const model = await db.selectFrom('${tableName}')
            .selectAll()
            .executeTakeFirst()
  
          if (! model)
            return undefined
  
          const instance = new ${modelName}Model(null)
  
          const result = await instance.mapWith(model)
  
          const data = new ${modelName}Model(result as ${modelName}Type)
  
          return data
        }
  
        async firstOrFail(): Promise<${modelName}Model | undefined> {
          return await ${modelName}Model.firstOrFail()
        }

        static async firstOrFail(): Promise<${modelName}Model | undefined> {
          const instance = new ${modelName}Model(null)

          const model = await instance.selectFromQuery.executeTakeFirst()
  
          if (model === undefined)
            throw new ModelNotFoundException(404, 'No ${modelName}Model results found for query')
  
          const result = await instance.mapWith(model)
  
          const data = new ${modelName}Model(result as ${modelName}Type)
  
          return data
        }

        async mapWith(model: ${modelName}Type): Promise<${modelName}Type> {
          ${relationStringThisMany}
          ${relationStringThisBelong}
  
          return model
        }
  
        static async all(): Promise<${modelName}Model[]> {
          const models = await db.selectFrom('${tableName}').selectAll().execute()
  
          const data = await Promise.all(models.map(async (model: ${modelName}Type) => {
            const instance = new ${modelName}Model(model)
  
            const results = await instance.mapWith(model)
  
            return new ${modelName}Model(results)
          }))
  
          return data
        }


        async findOrFail(id: number): Promise<${modelName}Model> {
          return await ${modelName}Model.findOrFail(id)
        }
  
        static async findOrFail(id: number): Promise<${modelName}Model> {
          const model = await db.selectFrom('${tableName}').where('id', '=', id).selectAll().executeTakeFirst()
  
          const instance = new ${modelName}Model(null)
  
          ${instanceSoftDeleteStatementsSelectFrom}
  
          if (model === undefined)
            throw new ModelNotFoundException(404, \`No ${modelName}Model results for \${id}\`)
  
          cache.getOrSet(\`${formattedModelName}:\${id}\`, JSON.stringify(model))
  
          const result = await instance.mapWith(model)
  
          const data = new ${modelName}Model(result as ${modelName}Type)
  
          return data
        }
  
        static async findMany(ids: number[]): Promise<${modelName}Model[]> {
          let query = db.selectFrom('${tableName}').where('id', 'in', ids)
  
          const instance = new ${modelName}Model(null)
  
          ${instanceSoftDeleteStatements}
  
          query = query.selectAll()
  
          const model = await query.execute()
  
          return model.map(modelItem => instance.parseResult(new ${modelName}Model(modelItem)))
        }
           
        skip(count: number): ${modelName}Model {
          return ${modelName}Model.skip(count)
        }

        static skip(count: number): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.offset(count)

          return instance
        }

        take(count: number): ${modelName}Model {
          return ${modelName}Model.take(count)
        }

        static take(count: number): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.limit(count)

          return instance
        }

        static async pluck<K extends keyof ${modelName}Model>(field: K): Promise<${modelName}Model[K][]> {
         const instance = new ${modelName}Model(null)

          if (instance.hasSelect) {
            const model = await instance.selectFromQuery.execute()
            return model.map((modelItem: ${modelName}Model) => modelItem[field])
          }

          const model = await instance.selectFromQuery.selectAll().execute()

          return model.map((modelItem: ${modelName}Model) => modelItem[field])
        }

        async pluck<K extends keyof ${modelName}Model>(field: K): Promise<${modelName}Model[K][]> {
          return ${modelName}Model.pluck(field)
        }

        static async count(): Promise<number> {
          const instance = new ${modelName}Model(null)

          return instance.selectFromQuery
            .select(sql\`COUNT(*) as count\`)
            .executeTakeFirst()
        }

        async count(): Promise<number> {
          return ${modelName}Model.count()
        }
        
        async max(field: keyof ${modelName}Model): Promise<number> {
          return await this.selectFromQuery
            .select(sql\`MAX(\${sql.raw(field as string)}) \`)
            .executeTakeFirst()
        }
         
        async min(field: keyof ${modelName}Model): Promise<number> {
          return await this.selectFromQuery
            .select(sql\`MIN(\${sql.raw(field as string)}) \`)
            .executeTakeFirst()
        }

        async avg(field: keyof ${modelName}Model): Promise<number> {
          return this.selectFromQuery
            .select(sql\`AVG(\${sql.raw(field as string)})\`)
            .executeTakeFirst()
        }

        async sum(field: keyof ${modelName}Model): Promise<number> {
          return this.selectFromQuery
            .select(sql\`SUM(\${sql.raw(field as string)})\`)
            .executeTakeFirst()
        }

        async get(): Promise<${modelName}Model[]> {
          return ${modelName}Model.get()
        }

        static async get(): Promise<${modelName}Model[]> {
          const instance = new ${modelName}Model(null)
  
          let models
        
          if (instance.hasSelect) {
            ${instanceSoftDeleteStatementsSelectFrom}
  
            models = await instance.selectFromQuery.execute()
          } else {
            ${instanceSoftDeleteStatementsSelectFrom}
  
            models = await instance.selectFromQuery.selectAll().execute()
          }
  
          const data = await Promise.all(models.map(async (model: ${modelName}Model) => {
            const instance = new ${modelName}Model(model)
  
            const results = await instance.mapWith(model)
  
            return new ${modelName}Model(results)
          }))
          
          return data
        }

        has(relation: string): ${modelName}Model {
          return ${modelName}Model.has(relation)
        }

        static has(relation: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.where(({ exists, selectFrom }: any) =>
            exists(
              selectFrom(relation)
                .select('1')
                .whereRef(\`\${relation}.${formattedModelName}_id\`, '=', '${tableName}.id'),
            ),
          )

          return instance
        }

        whereHas(
          relation: string,
          callback: (query: SubqueryBuilder) => void
        ): ${modelName}Model {
          return ${modelName}Model.whereHas(relation, callback)
        }

        static whereHas(
          relation: string,
          callback: (query: SubqueryBuilder) => void
        ): ${modelName}Model {
          const instance = new ${modelName}Model(null)
          const subqueryBuilder = new SubqueryBuilder()
          
          callback(subqueryBuilder)
          const conditions = subqueryBuilder.getConditions()
        
          instance.selectFromQuery = instance.selectFromQuery
            .where(({ exists, selectFrom }: any) => {
              let subquery = selectFrom(relation)
                .select('1')
                .whereRef(\`\${relation}.${formattedModelName}_id\`, '=', '${tableName}.id')
  
            conditions.forEach((condition) => {
              switch (condition.method) {
                case 'where':
                  if (condition.type === 'and') {
                    subquery = subquery.where(condition.column, condition.operator!, condition.value)
                  } else {
                    subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
                  }
                  break
                  
                case 'whereIn':
                  if (condition.operator === 'not') {
                    subquery = subquery.whereNotIn(condition.column, condition.values!)
                  } else {
                    subquery = subquery.whereIn(condition.column, condition.values!)
                  }

                  break
                  
                  case 'whereNull':
                    subquery = subquery.whereNull(condition.column)
                    break
                    
                  case 'whereNotNull':
                    subquery = subquery.whereNotNull(condition.column)
                  break
                  
                  case 'whereBetween':
                    subquery = subquery.whereBetween(condition.column, condition.values!)
                    break
                  
                  case 'whereExists': {
                    const nestedBuilder = new SubqueryBuilder()
                    condition.callback!(nestedBuilder)
                  break
                }
              }
            })
      
            return exists(subquery)
          })
            
          return instance
        }

        doesntHave(relation: string): ${modelName}Model {
          return ${modelName}Model.doesntHave(relation)
        }

        static doesntHave(relation: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.where(({ not, exists, selectFrom }: any) =>
            not(
              exists(
                selectFrom(relation)
                  .select('1')
                  .whereRef(\`\${relation}.${formattedModelName}_id\`, '=', '${tableName}.id'),
              ),
            )
          )

          return instance
        }

        whereDoesntHave(relation: string, callback: (query: SubqueryBuilder) => void): ${modelName}Model {
          return ${modelName}Model.whereDoesntHave(relation, callback)
        }

        static whereDoesntHave(
          relation: string,
          callback: (query: SubqueryBuilder) => void
        ): ${modelName}Model {
          const instance = new ${modelName}Model(null)
          const subqueryBuilder = new SubqueryBuilder()
          
          callback(subqueryBuilder)
          const conditions = subqueryBuilder.getConditions()
        
          instance.selectFromQuery = instance.selectFromQuery
            .where(({ exists, selectFrom, not }: any) => {
              let subquery = selectFrom(relation)
                .select('1')
                .whereRef(\`\${relation}.${formattedModelName}_id\`, '=', '${tableName}.id')
  
            conditions.forEach((condition) => {
              switch (condition.method) {
                case 'where':
                  if (condition.type === 'and') {
                    subquery = subquery.where(condition.column, condition.operator!, condition.value)
                  } else {
                    subquery = subquery.orWhere(condition.column, condition.operator!, condition.value)
                  }
                  break
                  
                case 'whereIn':
                  if (condition.operator === 'not') {
                    subquery = subquery.whereNotIn(condition.column, condition.values!)
                  } else {
                    subquery = subquery.whereIn(condition.column, condition.values!)
                  }

                  break
                  
                  case 'whereNull':
                    subquery = subquery.whereNull(condition.column)
                    break
                    
                  case 'whereNotNull':
                    subquery = subquery.whereNotNull(condition.column)
                  break
                  
                  case 'whereBetween':
                    subquery = subquery.whereBetween(condition.column, condition.values!)
                    break
                  
                  case 'whereExists': {
                    const nestedBuilder = new SubqueryBuilder()
                    condition.callback!(nestedBuilder)
                  break
                }
              }
            })
      
            return not(exists(subquery))
          })
            
          return instance
        }

        async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<${modelName}Response> {
          return ${modelName}Model.paginate(options)
        }
  
        // Method to get all ${tableName}
        static async paginate(options: QueryOptions = { limit: 10, offset: 0, page: 1 }): Promise<${modelName}Response> {
          const totalRecordsResult = await db.selectFrom('${tableName}')
            .select(db.fn.count('id').as('total')) // Use 'id' or another actual column name
            .executeTakeFirst()
  
          const totalRecords = Number(totalRecordsResult?.total) || 0
          const totalPages = Math.ceil(totalRecords / (options.limit ?? 10))
  
          const ${tableName}WithExtra = await db.selectFrom('${tableName}')
            .selectAll()
            .orderBy('id', 'asc') // Assuming 'id' is used for cursor-based pagination
            .limit((options.limit ?? 10) + 1) // Fetch one extra record
            .offset(((options.page ?? 1) - 1) * (options.limit ?? 10)) // Ensure options.page is not undefined
            .execute()
  
  
            let nextCursor = null
            if (${tableName}WithExtra.length > (options.limit ?? 10)) nextCursor = ${tableName}WithExtra.pop()?.id ?? null
  
          return {
            data: ${tableName}WithExtra,
            paging: {
              total_records: totalRecords,
              page: options.page || 1,
              total_pages: totalPages,
            },
            next_cursor: nextCursor,
          }
        }
  
        static async create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
          const instance = new ${modelName}Model(null)

          const filteredValues = Object.fromEntries(
            Object.entries(new${modelName}).filter(([key]) => 
              !instance.guarded.includes(key) && instance.fillable.includes(key)
            ),
          ) as New${modelName}

          ${uuidQuery}

          const result = await db.insertInto('${tableName}')
            .values(filteredValues)
            .executeTakeFirst()

          const model = await find(Number(result.numInsertedOrUpdatedRows)) as ${modelName}Model

          if (model)
            dispatch('${formattedTableName}:created', model)

          return model
        }
  
        static async createMany(new${modelName}: New${modelName}[]): Promise<void> {
          const instance = new ${modelName}Model(null)
  
          const filteredValues = Object.fromEntries(
            Object.entries(new${modelName}).filter(([key]) => 
              !instance.guarded.includes(key) && instance.fillable.includes(key)
            ),
          ) as New${modelName}
  
          ${uuidQueryMany}
          
          await db.insertInto('${tableName}')
            .values(filteredValues)
            .executeTakeFirst()
        }
  
        static async forceCreate(new${modelName}: New${modelName}): Promise<${modelName}Model> {
          const result = await db.insertInto('${tableName}')
            .values(new${modelName})
            .executeTakeFirst()
  
          const model = await find(Number(result.numInsertedOrUpdatedRows)) as ${modelName}Model
  
          ${mittCreateStatement}
  
          return model
        }
  
        // Method to remove a ${modelName}
        static async remove(id: number): Promise<any> {
          ${removeInstanceStatment}
  
          ${mittDeleteStaticFindStatement}
  
          ${instanceSoftDeleteStatementsUpdateFrom}
  
          ${mittDeleteStatement}
        
          return await db.deleteFrom('${tableName}')
            .where('id', '=', id)
            .execute()
        }
  
        private static applyWhere(instance: ${modelName}Model, column: string, operator: string, value: any): ${modelName}Model {
          instance.selectFromQuery = instance.selectFromQuery.where(column, operator, value)
          instance.updateFromQuery = instance.updateFromQuery.where(column, operator, value)
          instance.deleteFromQuery = instance.deleteFromQuery.where(column, operator, value)

          return instance
        }

        where(column: string, operator: string, value: any): ${modelName}Model {
          return ${modelName}Model.applyWhere(this, column, operator, value)
        }

        static where(column: string, operator: string, value: any): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          return ${modelName}Model.applyWhere(instance, column, operator, value)
        }

        whereRef(column: string, operator: string, value: string): ${modelName}Model {
          return ${modelName}Model.whereRef(column, operator, value)
        }

        static whereRef(column: string, operator: string, value: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.whereRef(column, operator, value)

          return instance
        }
  
        orWhere(...args: Array<[string, string, any]>): ${modelName}Model {
          return ${modelName}Model.orWhere(...args)
        }
  
        static orWhere(...args: Array<[string, string, any]>): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          if (args.length === 0) {
            throw new HttpError(500, "At least one condition must be provided");
          }
  
          // Use the expression builder to append the OR conditions
          instance.selectFromQuery =instance.selectFromQuery.where((eb: any) =>
            eb.or(
              args.map(([column, operator, value]) => eb(column, operator, value))
            )
          );
  
          instance.updateFromQuery =instance.updateFromQuery.where((eb: any) =>
            eb.or(
              args.map(([column, operator, value]) => eb(column, operator, value))
            )
          );
  
         instance.deleteFromQuery =instance.deleteFromQuery.where((eb: any) =>
            eb.or(
              args.map(([column, operator, value]) => eb(column, operator, value))
            )
          )
  
          return instance
        }

        when(
          condition: boolean,
          callback: (query: ${modelName}Model) => ${modelName}Model,
        ): ${modelName}Model {
          return ${modelName}Model.when(condition, callback)
        }
  
        static when(
          condition: boolean,
          callback: (query: ${modelName}Model) => ${modelName}Model,
        ): ${modelName}Model {
          let instance = new ${modelName}Model(null)
  
          if (condition)
            instance = callback(instance)
  
          return instance
        }

        whereNull(column: string): ${modelName}Model {
          return ${modelName}Model.whereNull(column)
        }
  
        static whereNull(column: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.where((eb: any) =>
            eb(column, '=', '').or(column, 'is', null)
          )
  
          instance.updateFromQuery = instance.updateFromQuery.where((eb: any) =>
            eb(column, '=', '').or(column, 'is', null)
          )
  
          return instance
        }
  
  
        ${whereStatements}
  
        whereIn(column: keyof ${modelName}Type, values: any[]): ${modelName}Model {
          return ${modelName}Model.whereIn(column, values)
        }
  
        static whereIn(column: keyof ${modelName}Type, values: any[]): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.where(column, 'in', values)
  
          instance.updateFromQuery = instance.updateFromQuery.where(column, 'in', values)
  
          instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'in', values)
  
          return instance
        }

        whereBetween(column: keyof ${modelName}Type, range: [any, any]): ${modelName}Model {
          return ${modelName}Model.whereBetween(column, range)
        }
  
        static whereBetween(column: keyof ${modelName}Type, range: [any, any]): ${modelName}Model {
          if (range.length !== 2) {
            throw new HttpError(500, 'Range must have exactly two values: [min, max]')
          }
  
          const instance = new ${modelName}Model(null)
  
          const query = sql\` \${sql.raw(column as string)} between \${range[0]} and \${range[1]} \`
  
          instance.selectFromQuery = instance.selectFromQuery.where(query)
          instance.updateFromQuery = instance.updateFromQuery.where(query)
          instance.deleteFromQuery = instance.deleteFromQuery.where(query)
  
          return instance
        }

        whereNotIn(column: keyof ${modelName}Type, values: any[]): ${modelName}Model {
          return ${modelName}Model.whereNotIn(column, values)
        }
  
        static whereNotIn(column: keyof ${modelName}Type, values: any[]): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.where(column, 'not in', values)
  
          instance.updateFromQuery = instance.updateFromQuery.where(column, 'not in', values)
  
          instance.deleteFromQuery = instance.deleteFromQuery.where(column, 'not in', values)
  
          return instance
        }
  
        async exists(): Promise<boolean> {
          const model = await this.selectFromQuery.executeTakeFirst()
  
          return model !== null || model !== undefined
        }

        static async latest(): Promise<${modelName}Type | undefined> {
          const model = await db.selectFrom('${tableName}')
            .selectAll()
            .orderBy('created_at', 'desc')
            .executeTakeFirst()

          if (!model)
            return undefined

          const instance = new ${modelName}Model(null)
          const result = await instance.mapWith(model)
          const data = new ${modelName}Model(result as ${modelName}Type)

          return data
        }

        static async oldest(): Promise<${modelName}Type | undefined> {
          const model = await db.selectFrom('${tableName}')
            .selectAll()
            .orderBy('created_at', 'asc')
            .executeTakeFirst()

          if (!model)
            return undefined

          const instance = new ${modelName}Model(null)
          const result = await instance.mapWith(model)
          const data = new ${modelName}Model(result as ${modelName}Type)

          return data
        }
  
        static async firstOrCreate(
          condition: Partial<${modelName}Type>,
          new${modelName}: New${modelName},
        ): Promise<${modelName}Model> {
          // Get the key and value from the condition object
          const key = Object.keys(condition)[0] as keyof ${modelName}Type
  
          if (!key) {
            throw new HttpError(500, 'Condition must contain at least one key-value pair')
          }
  
          const value = condition[key]
  
          // Attempt to find the first record matching the condition
          const existing${modelName} = await db.selectFrom('${tableName}')
            .selectAll()
            .where(key, '=', value)
            .executeTakeFirst()
  
          if (existing${modelName}) {
            const instance = new ${modelName}Model(null)
            const result = await instance.mapWith(existing${modelName})
            return new ${modelName}Model(result as ${modelName}Type)
          }
          else {
            return await this.create(new${modelName})
          }
        }
  
        static async updateOrCreate(
          condition: Partial<${modelName}Type>,
          new${modelName}: New${modelName},
        ): Promise<${modelName}Model> {
          const key = Object.keys(condition)[0] as keyof ${modelName}Type
  
          if (!key) {
            throw new HttpError(500, 'Condition must contain at least one key-value pair')
          }
  
          const value = condition[key]
  
          // Attempt to find the first record matching the condition
          const existing${modelName} = await db.selectFrom('${tableName}')
            .selectAll()
            .where(key, '=', value)
            .executeTakeFirst()
  
          if (existing${modelName}) {
            // If found, update the existing record
            await db.updateTable('${tableName}')
              .set(new${modelName})
              .where(key, '=', value)
              .executeTakeFirstOrThrow()
  
            // Fetch and return the updated record
            const updated${modelName} = await db.selectFrom('${tableName}')
              .selectAll()
              .where(key, '=', value)
              .executeTakeFirst()
  
            if (!updated${modelName}) {
              throw new HttpError(500, 'Failed to fetch updated record')
            }
  
            const instance = new ${modelName}Model(null)
            const result = await instance.mapWith(updated${modelName})
            return new ${modelName}Model(result as ${modelName}Type)
          } else {
            // If not found, create a new record
            return await this.create(new${modelName})
          }
        }
  
        with(relations: string[]): ${modelName}Model {
          return ${modelName}Model.with(relations)
        }
  
        static with(relations: string[]): ${modelName}Model {
         const instance = new ${modelName}Model(null)
  
          instance.withRelations = relations
          
          return instance
        }
  
        async last(): Promise<${modelName}Type | undefined> {
          return await db.selectFrom('${tableName}')
            .selectAll()
            .orderBy('id', 'desc')
            .executeTakeFirst()
        }
  
        static async last(): Promise<${modelName}Type | undefined> {
          const model = await db.selectFrom('${tableName}').selectAll().orderBy('id', 'desc').executeTakeFirst()
  
          if (!model)
            return undefined
  
          const instance = new ${modelName}Model(null)
  
          const result = await instance.mapWith(model)
  
          const data = new ${modelName}Model(result as ${modelName}Type)
  
          return data
        }

        orderBy(column: keyof ${modelName}Type, order: 'asc' | 'desc'): ${modelName}Model {
          return ${modelName}Model.orderBy(column, order)
        }
  
        static orderBy(column: keyof ${modelName}Type, order: 'asc' | 'desc'): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.orderBy(column, order)
  
          return instance
        }

        groupBy(column: keyof ${modelName}Type): ${modelName}Model {
          return ${modelName}Model.groupBy(column)
        }
  
        static groupBy(column: keyof ${modelName}Type): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.groupBy(column)
  
          return instance
        }

        having(column: keyof ${modelName}Type, operator: string, value: any): ${modelName}Model {
          return ${modelName}Model.having(column, operator, value)
        }

        static having(column: keyof ${modelName}Type, operator: string, value: any): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.having(column, operator, value)
  
          return instance
        }

        inRandomOrder(): ${modelName}Model {
          return ${modelName}Model.inRandomOrder()
        }
        
        static inRandomOrder(): ${modelName}Model {
          const instance = new ${modelName}Model(null)

          instance.selectFromQuery = instance.selectFromQuery.orderBy(sql\` \${sql.raw('RANDOM()')} \`)

          return instance
        }

        orderByDesc(column: keyof ${modelName}Type): ${modelName}Model {
          return ${modelName}Model.orderByDesc(column)
        }

        static orderByDesc(column: keyof ${modelName}Type): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'desc')
  
          return instance
        }
          
        orderByAsc(column: keyof ${modelName}Type): ${modelName}Model {
          return ${modelName}Model.orderByAsc(column)
        }
  
        static orderByAsc(column: keyof ${modelName}Type): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.orderBy(column, 'asc')
  
          return instance
        }

        async update(new${modelName}: ${modelName}Update): Promise<${modelName}Model | undefined> {
          const filteredValues = Object.fromEntries(
            Object.entries(new${modelName}).filter(([key]) => 
              !this.guarded.includes(key) && this.fillable.includes(key)
            ),
          ) as New${modelName}

          await db.updateTable('${tableName}')
            .set(filteredValues)
            .where('id', '=', this.id)
            .executeTakeFirst()

          if (this.id) {
            const model = await this.find(this.id)

            ${mittUpdateStatement}
    
            return model
          }

          return undefined
        }
  
        async forceUpdate(${formattedModelName}: ${modelName}Update): Promise<${modelName}Model | undefined> {
          if (this.id === undefined) {
            this.updateFromQuery.set(${formattedModelName}).execute()
          }
  
          await db.updateTable('${tableName}')
            .set(${formattedModelName})
            .where('id', '=', this.id)
            .executeTakeFirst()
  
          if (this.id) {
            const model = await this.find(this.id)
  
  
            ${mittUpdateStatement}
  
            return model
          }

          return undefined
        }
  
        async save(): Promise<void> {
          if (!this)
            throw new HttpError(500, '${modelName} data is undefined')
  
          if (this.id === undefined) {
            await db.insertInto('${tableName}')
              .values(this as New${modelName})
              .executeTakeFirstOrThrow()
          }
          else {
            await this.update(this)
          }
        }
  
        // Method to delete (soft delete) the ${formattedModelName} instance
        async delete(): Promise<any> {
          if (this.id === undefined)
            this.deleteFromQuery.execute()
            ${mittDeleteFindStatement}
            ${mittDeleteStatement}
            ${thisSoftDeleteStatementsUpdateFrom}
  
            return await db.deleteFrom('${tableName}')
              .where('id', '=', this.id)
              .execute()
        }
  
        ${relationMethods}
  
        ${displayableStatements}
  
        ${billableStatements}
  
        distinct(column: keyof ${modelName}Type): ${modelName}Model {
          return ${modelName}Model.distinct(column)
        }
  
        static distinct(column: keyof ${modelName}Type): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.select(column).distinct()
  
          instance.hasSelect = true
  
          return instance
        }
  
        join(table: string, firstCol: string, secondCol: string): ${modelName}Model {
          return ${modelName}Model.join(table, firstCol, secondCol)
        }
  
        static join(table: string, firstCol: string, secondCol: string): ${modelName}Model {
          const instance = new ${modelName}Model(null)
  
          instance.selectFromQuery = instance.selectFromQuery.innerJoin(table, firstCol, secondCol)
  
          return instance
        }
  
        static async rawQuery(rawQuery: string): Promise<any> {
          return await sql\`\${rawQuery}\`\.execute(db)
        }
  
        toJSON(): Partial<${modelName}JsonResponse> {
          const output: Partial<${modelName}JsonResponse> = ${jsonFields}

          return output
        }
  
        parseResult(model: ${modelName}Model): ${modelName}Model {
          for (const hiddenAttribute of this.hidden) {
            delete model[hiddenAttribute as keyof ${modelName}Model]
          }

          return model
        }
  
        ${twoFactorStatements}
      }
  
      async function find(id: number): Promise<${modelName}Model | undefined> {
        let query = db.selectFrom('${tableName}').where('id', '=', id).selectAll()
  
        const model = await query.executeTakeFirst()
  
        if (!model) return undefined
  
        return new ${modelName}Model(model)
      }
  
      export async function count(): Promise<number> {
        const results = await ${modelName}Model.count()
  
        return results
      }
  
      export async function create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
  
        const result = await db.insertInto('${tableName}')
          .values(new${modelName})
          .executeTakeFirstOrThrow()
  
        return await find(Number(result.numInsertedOrUpdatedRows)) as ${modelName}Model
      }
  
      export async function rawQuery(rawQuery: string): Promise<any> {
        return await sql\`\${rawQuery}\`\.execute(db)
      }
  
      export async function remove(id: number): Promise<void> {
        await db.deleteFrom('${tableName}')
          .where('id', '=', id)
          .execute()
      }
  
      ${whereFunctionStatements}
  
      export const ${modelName} = ${modelName}Model
  
      export default ${modelName}
      `
}
