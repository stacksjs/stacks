import type {
  Model,
  ModelElement,
  RelationConfig,
} from '@stacksjs/types'
import { camelCase, pascalCase, plural, singular, snakeCase } from '@stacksjs/strings'
import { fetchOtherModelRelations, getFillableAttributes, getGuardedAttributes, getHiddenAttributes, getRelationCount, getRelations, getRelationType, mapEntity } from './utils'

/**
 * This file generates model classes that extend BaseOrm.
 * Many common query methods are inherited from BaseOrm and not duplicated here:
 * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
 * - inRandomOrder, max, min, avg, paginate, and more
 *
 * See BaseOrm class for the full list of inherited methods.
 */

// const userModel = (await import(path.userModelsPath('User.ts'))).default

// generateCustomAccessors(userModel)

function generateCustomAccessors(model: Model): string {
  let output = ''
  if (model.get) {
    for (const [methodName, getter] of Object.entries(model.get)) {
      const getterStr = getter.toString()
      output += removeAttrString(`${methodName}: ${getterStr}, \n`)
    }
  }

  return output
}

function generateCustomSetters(model: Model): string {
  let output = ''

  if (model.set) {
    for (const [methodName, setter] of Object.entries(model.set)) {
      const setterStr = setter.toString()
      output += removeAttrString(`${methodName}: ${setterStr}, \n`)
    }
  }

  return output
}

function removeAttrString(getterFn: string): string {
  let result = getterFn.replace('(attributes)', '()')

  result = result.replace(/attributes/g, 'model')

  return result
}

function getUpvoteTableName(model: Model, tableName: string): string {
  const defaultTable = `${tableName}_likes`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.table || defaultTable
    : defaultTable
}

function getUpvoteForeignKey(model: Model, modelName: string): string {
  const defaultForeignKey = `${snakeCase(modelName)}_id`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.foreignKey || defaultForeignKey
    : defaultForeignKey
}

export async function findRelation(model: Model, modelName: string, relationName: string): Promise<RelationConfig | undefined> {
  const relations = await getRelations(model, modelName)

  return relations.find(relationStr => relationStr.relationName === relationName)
}

export async function generateModelString(
  tableName: string,
  modelName: string,
  model: Model,
  attributes: ModelElement[],
  imports: string[] = [],
): Promise<string> {
  // Remove unused variables
  const formattedTableName = pascalCase(tableName) // users -> Users
  const formattedModelName = camelCase(modelName) // User -> user

  // Start with the imports
  const importsString = `${imports.join('\n')}\n\n`

  let instanceSoftDeleteStatements = ''
  let instanceSoftDeleteStatementsSelectFrom = ''
  let instanceSoftDeleteStatementsUpdateFrom = ''
  let thisSoftDeleteStatementsUpdateFrom = ''

  let getFields = ''
  let setFields = ''
  // const constructorFields = ''
  let jsonFields = '{\n'
  let jsonRelations = ''
  // let declareFields = ''
  let uuidQuery = ''
  let whereStatements = ''
  let whereFunctionStatements = ''
  let relationMethods = ''
  let relationImports = ''
  let paymentImports = ''
  let categorizableImports = ''
  let commentablesImports = ''
  let taggableImports = ''
  let twoFactorStatements = ''
  let billableStatements = ''
  let likeableStatements = ''
  let displayableStatements = ''
  let removeInstanceStatment = ''
  let mittCreateStatement = ''
  let mittUpdateStatement = ''
  let mittDeleteStatement = ''
  let mittDeleteStaticFindStatement = ''
  let mittDeleteFindStatement = ''
  let privateSoftDeletes = ''

  const getterOutput = await generateCustomAccessors(model)
  const setterOutput = await generateCustomSetters(model)

  const relations = await getRelations(model, modelName)

  for (const relationInstance of relations)
    relationImports += `import type {${relationInstance.model}Model} from './${relationInstance.model}'\n\n`

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSocials = model?.traits?.useSocials && Array.isArray(model.traits.useSocials) && model.traits.useSocials.length > 0
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false
  const observer = model?.traits?.observe
  const useUuid = model?.traits?.useUuid || false
  const useCommentables = model?.traits?.commentables || false

  if (useUuid)
    uuidQuery += `filteredValues['uuid'] = randomUUIDv7()`

  if (useSoftDeletes) {
    privateSoftDeletes = `private softDeletes = false`
    instanceSoftDeleteStatements += `if (instance.softDeletes) {
        query = query.where('deleted_at', 'is', null)
      }`

    // eslint-disable-next-line unused-imports/no-unused-vars
    instanceSoftDeleteStatementsSelectFrom += ` if (instance.softDeletes) {
        instance.selectFromQuery = instance.selectFromQuery.where('deleted_at', 'is', null)
      }`

    instanceSoftDeleteStatementsUpdateFrom += `
        const instance = new ${modelName}Model(undefined)

        if (instance.softDeletes) {
          return await DB.instance.updateTable('${tableName}')
          .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP'),
          })
          .where('id', '=', id)
          .execute()
        }
      `

    thisSoftDeleteStatementsUpdateFrom += `if (this.softDeletes) {
        return await DB.instance.updateTable('${tableName}')
        .set({
            deleted_at: sql.raw('CURRENT_TIMESTAMP')
        })
        .where('id', '=', this.id)
        .execute()
      }`
  }

  if (typeof observer === 'boolean') {
    if (observer) {
      removeInstanceStatment += `const instance = new ${modelName}Model(undefined)`
      mittCreateStatement += `if (model)\n dispatch('${formattedModelName}:created', model)`
      mittUpdateStatement += `if (model)\n dispatch('${formattedModelName}:updated', model)`
      mittDeleteStatement += `if (model)\n dispatch('${formattedModelName}:deleted', model)`

      mittDeleteStaticFindStatement += 'const model = await instance.find(Number(id))'
      mittDeleteFindStatement += 'const model = await this.find(Number(this.id))'
    }
  }

  if (Array.isArray(observer)) {
    removeInstanceStatment += `const instance = new ${modelName}Model(undefined)`
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

  if (useCommentables) {
    commentablesImports += `import type { CommentablesTable } from '@stacksjs/orm'\n`
    relationMethods += `
      async comments(id: number): Promise<CommentablesTable[]> {
        return await this.baseComments(id)
      }

      async commentCount(id: number): Promise<number> {
        return await this.baseCommentCount(id)
      }

      async addComment(id: number, comment: { title: string, body: string }): Promise<any> {
        return await this.baseAddComment(id, comment)
      }

      async approvedComments(id: number): Promise<CommentablesTable[]> {
        return await this.baseApprovedComments(id)
      }

      async pendingComments(id: number): Promise<CommentablesTable[]> {
        return await this.basePendingComments(id)
      }

      async rejectedComments(id: number): Promise<CommentablesTable[]> {
        return await this.baseRejectedComments(id)
      }
    `
  }

  if (model.traits?.taggable) {
    taggableImports += `import type { TaggableTable } from '@stacksjs/orm'\n`

    relationMethods += `
      async tags(id: number): Promise<TaggableTable[]> {
        return await this.baseTags(id)
      }

      async tagCount(id: number): Promise<number> {
        return await this.baseTagCount(id)
      }

      async addTag(id: number, tag: { name: string, description?: string }): Promise<TaggableTable> {
        return await this.baseAddTag(id, tag)
      }

      async activeTags(id: number): Promise<TaggableTable[]> {
        return await this.baseActiveTags(id)
      }

      async inactiveTags(id: number): Promise<TaggableTable[]> {
        return await this.baseInactiveTags(id)
      }

      async removeTag(id: number, tagId: number): Promise<void> {
        await this.baseRemoveTag(id, tagId)
      }
    `
  }

  if (model.traits?.categorizable) {
    categorizableImports += `import type { CategorizableTable } from '@stacksjs/orm'\n`

    relationMethods += `
      async categories(id: number): Promise<CategorizableTable[]> {
        return await this.baseCategories(id)
      }

      async categoryCount(id: number): Promise<number> {
        return await this.baseCategoryCount(id)
      }

      async addCategory(id: number, category: { name: string, description?: string, parent_id?: number }): Promise<CategorizableTable> {
        return await this.baseAddCategory(id, category)
      }

      async activeCategories(id: number): Promise<CategorizableTable[]> {
        return await this.baseActiveCategories(id)
      }

      async inactiveCategories(id: number): Promise<CategorizableTable[]> {
        return await this.baseInactiveCategories(id)
      }

      async removeCategory(categoryId: number): Promise<void> {
        await this.baseRemoveCategory(categoryId)
      }
    `
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

          const firstModel = await DB.instance.selectFrom('${throughTableRelation}')
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

      // declareFields += `public ${snakeCase(relationName)}: ${modelRelation}Model[] | undefined\n`
      getFields += `get ${snakeCase(relationName)}():${modelRelation}Model[] | [] {
        return this.attributes.${snakeCase(relationName)}
      }\n\n`

      jsonRelations += `${snakeCase(relationName)}: this.${snakeCase(relationName)},\n`
    }

    if (relationType === 'morphType' && relationCount === 'one') {
      const morphName = relation.relationName || `${formattedModelName}able`

      // Add field to the model for relationship access
      getFields += `get ${snakeCase(morphName)}():${modelRelation}Model | undefined {
        return this.attributes.${snakeCase(morphName)}
      }\n\n`

      // Add relationship to JSON output
      jsonRelations += `${snakeCase(morphName)}: this.${snakeCase(morphName)},\n`

      // Add method to retrieve the polymorphic related model
      relationMethods += `
        async ${morphName}(): Promise<${modelRelation}Model | undefined> {
          if (this.id === undefined)
            throw new HttpError(500, 'Relation Error!')

          const model = await ${modelRelation}
            .where('${relation.modelKey}', '=', '${modelName}')
            .where('${relation.foreignKey}', '=', this.id)
            .first()

          if (!model)
            return undefined

          return model
        }\n\n`
    }

    if (relationType === 'morphType' && relationCount === 'many') {
      const morphName = relation.relationName || `${formattedModelName}able`

      // Add field to the model for relationship access
      getFields += `get ${snakeCase(morphName)}():${modelRelation}Model[] | [] {
        return this.attributes.${snakeCase(morphName)}
      }\n\n`

      // Add relationship to JSON output
      jsonRelations += `${snakeCase(morphName)}: this.${snakeCase(morphName)},\n`

      // Add method to retrieve the polymorphic related models
      relationMethods += `
        async ${morphName}(): Promise<${modelRelation}Model[]> {
          if (this.id === undefined)
            throw new HttpError(500, 'Relation Error!')

          const models = await ${modelRelation}
            .where('${relation.modelKey}', '=', '${modelName}')
            .where('${relation.foreignKey}', '=', this.id)
            .get()

          if (!models || !models.length)
            return []

          return models
        }\n\n`
    }

    if (relationType === 'hasType' && relationCount === 'one') {
      const relationName = relation.relationName || formattedModelRelation

      getFields += `get ${snakeCase(relationName)}():${modelRelation}Model | undefined {
        return this.attributes.${snakeCase(relationName)}
      }\n\n`
    }

    if (relationType === 'belongsType' && !relationCount) {
      const relationName = camelCase(relation.relationName || formattedModelRelation)

      getFields += `get ${relation.modelKey}(): number {
        return this.attributes.${relation.modelKey}
      }\n\n`

      jsonRelations += `${relation.modelKey}: this.${relation.modelKey},\n   `

      getFields += `get ${snakeCase(relationName)}(): ${modelRelation}Model | undefined {
        return this.attributes.${snakeCase(relationName)}
      }\n\n`

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

          const results = await DB.instance.selectFrom('${pivotTable}')
            .where('${pivotKey}', '=', this.id)
            .selectAll()
            .execute()

            const tableRelationIds = results.map((result: { ${singular(tableRelation)}_id: number }) => result.${singular(tableRelation)}_id)

            if (! tableRelationIds.length)
              throw new HttpError(500, 'Relation Error!')

            const relationResults = await ${modelRelation}.whereIn('id', tableRelationIds).get()

            return relationResults
        }\n\n`
    }
  }

  // declareFields += `public id: number | undefined \n   `

  getFields += `get id(): number {
    return this.attributes.id
  }\n\n`

  // constructorFields += `this.id = ${formattedModelName}?.id || 1\n   `

  const useTwoFactor = typeof model.traits?.useAuth === 'object' && model.traits.useAuth.useTwoFactor
  const usePasskey = typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey
  const useBillable = model.traits?.billable || false
  const useLikeable = model.traits?.likeable || false

  const useSearchable = model.traits?.useSearch || false
  const displayableAttributes = typeof model.traits?.useSearch === 'object' && model.traits?.useSearch.displayable

  const likeableTable = getUpvoteTableName(model, tableName)
  const likeableForeignKey = getUpvoteForeignKey(model, modelName)

  const searchableStatements = ''
  if (typeof useSearchable === 'object' && useSearchable) {
    const searchAttrs = Array.isArray(displayableAttributes) ? displayableAttributes : []

    displayableStatements = `
      toSearchableObject(): Partial<${modelName}JsonResponse> {
        return {
          ${searchAttrs
            .map(attr => `${snakeCase(attr)}: this.${snakeCase(attr)}`)
            .join(',\n')}
        }
      }
    `
  }

  if (useLikeable) {
    likeableStatements += `
      async getLikeCount(): Promise<number> {
        const result = await DB.instance
          .selectFrom('${likeableTable}')
          .select('count(*) as count')
          .where('${likeableForeignKey}', '=', this.id)
          .executeTakeFirst()

        return Number(result?.count) || 0
      }\n\n

      async likes(): Promise<number> {
        return this.getLikeCount()
      }\n\n

      async like(userId: number): Promise<void> {
        const authUserId = userId || 1

        await DB.instance
          .insertInto('${likeableTable}')
          .values({
            ${likeableForeignKey}: this.id,
            user_id: authUserId
          })
        .execute()
      }\n\n

      async unlike(userId: number): Promise<void> {
        const authUserId = userId || 1
        await DB.instance
          .deleteFrom('${likeableTable}')
          .where('${likeableForeignKey}', '=', this.id)
          .where('user_id', '=', authUserId)
          .execute()
      }\n\n

      async isLiked(userId: number): Promise<boolean> {
        const authUserId = userId || 1

        const like = await DB.instance
          .selectFrom('${likeableTable}')
          .select('id')
          .where('${likeableForeignKey}', '=', this.id)
          .where('user_id', '=', authUserId)
          .executeTakeFirst()

        return !!like
      }
    `
  }

  if (useBillable) {
    paymentImports += `import type { PaymentMethodModel } from '../types/PaymentMethodType'
      import type { PaymentTransactionsTable } from '../types/PaymentTransactionType'
      import type { PaymentMethodModelType } from '../types/PaymentMethodType'`

    billableStatements += ` async createStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      const customer = await manageCustomer.createStripeCustomer(this, options)

        return customer
      }

      async updateStripeUser(options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
        const customer = await manageCustomer.updateStripeCustomer(this, options)

        return customer
      }

      async storeTransaction(productId: number): Promise<PaymentTransactionsTable | undefined> {
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

       async defaultPaymentMethod(): Promise<PaymentMethodModelType | undefined> {
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

      async retrievePaymentMethod(paymentMethod: number): Promise<PaymentMethodsTable | undefined> {
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

      async transactionHistory(): Promise<PaymentTransactionsTable[]> {
        return manageTransaction.list(this)
      }

      async stripeSubscriptions(): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
        return manageInvoice.list(this)
      }

      async activeSubscription() {
        const subscription = await DB.instance.selectFrom('subscriptions')
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

      async paymentMethods(cardType?: string): Promise<PaymentMethodsTable[]> {
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

    // declareFields += `public stripe_id: string | undefined\n`

    getFields += `get stripe_id(): string | undefined {
      return this.attributes.stripe_id
    }\n\n`

    setFields += `set stripe_id(value: string) {
      this.attributes.stripe_id = value
    }\n\n`

    // constructorFields += `this.stripe_id = ${formattedModelName}?.stripe_id\n   `
  }

  if (useTwoFactor) {
    // declareFields += `public two_factor_secret: string | undefined \n`

    getFields += `get two_factor_secret(): string | undefined {
      return this.attributes.two_factor_secret
    }\n\n`

    setFields += `set two_factor_secret(value: string) {
      this.attributes.two_factor_secret = value
    }\n\n`

    // constructorFields += `this.two_factor_secret = ${formattedModelName}?.two_factor_secret\n   `

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
    getFields += `get uuid(): string | undefined {
      return this.attributes.uuid
    }\n\n`

    setFields += `set uuid(value: string) {
      this.attributes.uuid = value
    }\n\n`

    jsonFields += '\n uuid: this.uuid,\n'
  }

  if (usePasskey) {
    // declareFields += 'public public_passkey: string | undefined \n'
    getFields += `get public_passkey(): string | undefined {
      return this.attributes.public_passkey
    }\n\n`

    setFields += `set public_passkey(value: string) {
      this.attributes.public_passkey = value
    }\n\n`
    // constructorFields += `this.public_passkey = ${formattedModelName}?.public_passkey\n   `
  }

  jsonFields += '\nid: this.id,\n'
  for (const attribute of attributes) {
    const entity = mapEntity(attribute)

    const undefinedIndicator = attribute.required === false ? ' | undefined' : ''

    getFields += `get ${snakeCase(attribute.field)}(): ${entity}${undefinedIndicator} {
      return this.attributes.${snakeCase(attribute.field)}
    }\n\n`

    setFields += `set ${snakeCase(attribute.field)}(value: ${entity}) {
      this.attributes.${snakeCase(attribute.field)} = value
    }\n\n`

    // Only add to jsonFields if the attribute is not hidden
    if (!attribute.hidden)
      jsonFields += `${snakeCase(attribute.field)}: this.${snakeCase(attribute.field)},\n   `

    whereStatements += `static where${pascalCase(attribute.field)}(value: string): ${modelName}Model {
          const instance = new ${modelName}Model(undefined)

          instance.selectFromQuery = instance.selectFromQuery.where('${snakeCase(attribute.field)}', '=', value)

          return instance
        } \n\n`

    whereFunctionStatements += `export async function where${pascalCase(attribute.field)}(value: ${entity}): Promise<${modelName}Model[]> {
          const query = DB.instance.selectFrom('${tableName}').where('${snakeCase(attribute.field)}', '=', value)
          const results: ${modelName}JsonResponse = await query.execute()

          return results.map((modelItem: ${modelName}JsonResponse) => new ${modelName}Model(modelItem))
        } \n\n`
  }

  if (useSocials) {
    const socials = model.traits?.useSocials || []

    if (socials.includes('google')) {
      setFields += `set google_id(value: string) {
        this.attributes.google_id = value
      }\n\n`

      getFields += `get google_id(): string | undefined {
        return this.attributes.google_id
      }\n\n`
    }

    if (socials.includes('github')) {
      setFields += `set github_id(value: string) {
        this.attributes.github_id = value
      }\n\n`

      getFields += `get github_id(): string | undefined {
        return this.attributes.github_id
      }\n\n`
    }

    if (socials.includes('twitter')) {
      setFields += `set twitter_id(value: string) {
        this.attributes.twitter_id = value
      }\n\n`

      getFields += `get twitter_id(): string | undefined {
        return this.attributes.twitter_id
      }\n\n`
    }

    if (socials.includes('facebook')) {
      setFields += `set facebook_id(value: string) {
        this.attributes.facebook_id = value
      }\n\n`

      getFields += `get facebook_id(): string | undefined {
        return this.attributes.facebook_id
      }\n\n`
    }
  }

  if (useTimestamps) {
    getFields += `get created_at(): string | undefined {
      return this.attributes.created_at
    }

    get updated_at(): string | undefined {
      return this.attributes.updated_at
    }\n\n`

    setFields += `set updated_at(value: string) {
      this.attributes.updated_at = value
    }\n\n`

    // constructorFields += `
    //     this.created_at = ${formattedModelName}?.created_at\n
    //     this.updated_at = ${formattedModelName}?.updated_at\n
    //   `

    jsonFields += `
        created_at: this.created_at,\n
        updated_at: this.updated_at,\n
      `
  }

  if (useSoftDeletes) {
    getFields += `get deleted_at(): string | undefined {
      return this.attributes.deleted_at
    }\n\n`

    setFields += `set deleted_at(value: string) {
      this.attributes.deleted_at = value
    }\n\n`

    jsonFields += `
        deleted_at: this.deleted_at,\n
      `
  }

  jsonFields += jsonRelations
  jsonFields += `...this.customColumns,\n`

  const otherModelRelations = await fetchOtherModelRelations(modelName)

  if (useSocials) {
    const socials = model.traits?.useSocials || []
    if (socials.includes('google')) {
      jsonFields += 'google_id: this.google_id,\n'
    }

    if (socials.includes('github')) {
      jsonFields += 'github_id: this.github_id,\n'
    }

    if (socials.includes('twitter')) {
      jsonFields += 'twitter_id: this.twitter_id,\n'
    }

    if (socials.includes('facebook')) {
      jsonFields += 'facebook_id: this.facebook_id,\n'
    }
  }

  if (useTwoFactor && tableName === 'users') {
    jsonFields += 'two_factor_secret: this.two_factor_secret\n'
  }

  if (usePasskey && tableName === 'users') {
    jsonFields += 'public_passkey: this.public_passkey,\n'
  }

  if (useBillable && tableName === 'users') {
    jsonFields += 'stripe_id: this.stripe_id, \n'
  }

  jsonFields += '}'

  const hidden = JSON.stringify(getHiddenAttributes(model.attributes))
  const fillable = JSON.stringify(getFillableAttributes(model, otherModelRelations))
  const guarded = JSON.stringify(getGuardedAttributes(model))

  const classString = `import type { Generated, Insertable, RawBuilder, Selectable, Updateable, Sql} from '@stacksjs/database'
import { manageCharge, manageCheckout, manageCustomer, manageInvoice, managePaymentMethod, manageSubscription, manageTransaction, managePrice, manageSetupIntent } from '@stacksjs/payments'
import Stripe from 'stripe'
import { sql } from '@stacksjs/database'
import { DB } from '@stacksjs/orm'
import { BaseOrm } from '../utils/base'
import type { Operator } from '@stacksjs/orm'
import type { CheckoutLineItem, CheckoutOptions, StripeCustomerOptions } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling'
import { dispatch } from '@stacksjs/events'
import { generateTwoFactorSecret } from '@stacksjs/auth'
import { verifyTwoFactorCode } from '@stacksjs/auth'
import { randomUUIDv7 } from 'bun'
import type { ${modelName}ModelType, ${modelName}JsonResponse, New${modelName}, ${modelName}Update, ${pascalCase(tableName)}Table } from '../types/${modelName}Type'
${paymentImports}
${relationImports}
${categorizableImports}
${commentablesImports}
${importsString}
${taggableImports}

export class ${modelName}Model extends BaseOrm<${modelName}Model, ${formattedTableName}Table, ${modelName}JsonResponse> {
  private readonly hidden: Array<keyof ${modelName}JsonResponse> = ${hidden}
  private readonly fillable: Array<keyof ${modelName}JsonResponse> = ${fillable}
  private readonly guarded: Array<keyof ${modelName}JsonResponse> = ${guarded}
  protected attributes = {} as ${modelName}JsonResponse
  protected originalAttributes = {} as ${modelName}JsonResponse
  ${privateSoftDeletes}
  protected selectFromQuery: any
  protected updateFromQuery: any
  protected deleteFromQuery: any
  protected hasSelect: boolean
  private customColumns: Record<string, unknown> = {}

  /**
   * This model inherits many query methods from BaseOrm:
   * - pluck, chunk, whereExists, has, doesntHave, whereHas, whereDoesntHave
   * - inRandomOrder, max, min, avg, paginate, get, and more
   *
   * See BaseOrm class for the full list of inherited methods.
   */

  constructor(${formattedModelName}: ${modelName}JsonResponse | undefined) {
    super('${tableName}')
    if (${formattedModelName}) {

      this.attributes = { ...${formattedModelName} }
      this.originalAttributes = { ...${formattedModelName} }

      Object.keys(${formattedModelName}).forEach(key => {
        if (!(key in this)) {
           this.customColumns[key] = (${formattedModelName} as ${modelName}JsonResponse)[key]
        }
      })
    }

    this.withRelations = []
    this.selectFromQuery = DB.instance.selectFrom('${tableName}')
    this.updateFromQuery = DB.instance.updateTable('${tableName}')
    this.deleteFromQuery = DB.instance.deleteFrom('${tableName}')
    this.hasSelect = false
  }

  protected async loadRelations(models: ${modelName}JsonResponse | ${modelName}JsonResponse[]): Promise<void> {
    // Handle both single model and array of models
    const modelArray = Array.isArray(models) ? models : [models]
    if (!modelArray.length) return

    const modelIds = modelArray.map(model => model.id)

    for (const relation of this.withRelations) {
      const relatedRecords = await DB.instance
        .selectFrom(relation)
        .where('${formattedModelName}_id', 'in', modelIds)
        .selectAll()
        .execute()

      if (Array.isArray(models)) {
        models.map((model: ${modelName}JsonResponse) => {
          const records = relatedRecords.filter((record: { ${formattedModelName}_id: number }) => {
            return record.${formattedModelName}_id === model.id
          })

          model[relation] = records.length === 1 ? records[0] : records
          return model
        })
      } else {
        const records = relatedRecords.filter((record: { ${formattedModelName}_id: number }) => {
          return record.${formattedModelName}_id === models.id
        })

        models[relation] = records.length === 1 ? records[0] : records
      }
    }
  }

  static with(relations: string[]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWith(relations)
  }

  protected mapCustomGetters(models: ${modelName}JsonResponse | ${modelName}JsonResponse[]): void {
    const data = models

    if (Array.isArray(data)) {
      data.map((model: ${modelName}JsonResponse) => {

        const customGetter = {
          default: () => {
          },

          ${getterOutput}
        }

        for (const [key, fn] of Object.entries(customGetter)) {
          (model as any)[key] = fn()
        }

        return model
      })
    } else {
      const model = data

      const customGetter = {
        default: () => {
        },

        ${getterOutput}
      }

      for (const [key, fn] of Object.entries(customGetter)) {
        (model as any)[key] = fn()
      }
    }
  }

  async mapCustomSetters(model: New${modelName} | ${modelName}Update): Promise<void> {
    const customSetter = {
      default: () => {
      },

      ${setterOutput}
    }

    for (const [key, fn] of Object.entries(customSetter)) {
        (model as any)[key] = await fn()
    }
  }

  ${getFields}
  ${setFields}

  static select(params: (keyof ${modelName}JsonResponse)[] | RawBuilder<string> | string): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applySelect(params)
  }

  // Method to find a ${modelName} by ID
  static async find(id: number): Promise<${modelName}Model | undefined> {
    let query = DB.instance.selectFrom('${tableName}').where('id', '=', id).selectAll()

    const model = await query.executeTakeFirst()

    if (!model) return undefined

    const instance = new ${modelName}Model(undefined)
    return instance.createInstance(model)
  }

  static async first(): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    const model = await instance.applyFirst()

    const data = new ${modelName}Model(model)

    return data
  }

  static async last(): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    const model = await instance.applyLast()

    if (!model) return undefined

    return new ${modelName}Model(model)
  }

  static async firstOrFail(): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyFirstOrFail()
  }

  static async all(): Promise<${modelName}Model[]> {
    const instance = new ${modelName}Model(undefined)

    const models = await DB.instance.selectFrom('${tableName}').selectAll().execute()

    instance.mapCustomGetters(models)

    const data = await Promise.all(models.map(async (model: ${modelName}JsonResponse) => {
      return new ${modelName}Model(model)
    }))

    return data
  }

  static async findOrFail(id: number): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyFindOrFail(id)
  }

  static async findMany(ids: number[]): Promise<${modelName}Model[]> {
    const instance = new ${modelName}Model(undefined)
     ${instanceSoftDeleteStatements}
    const models = await instance.applyFindMany(ids)

    return models.map((modelItem: ${modelName}JsonResponse) => instance.parseResult(new ${modelName}Model(modelItem)))
  }

  static async latest(column: keyof ${formattedTableName}Table = 'created_at'): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'desc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new ${modelName}Model(model)
  }

  static async oldest(column: keyof ${formattedTableName}Table = 'created_at'): Promise<${modelName}Model | undefined> {
    const instance = new ${modelName}Model(undefined)

    const model = await instance.selectFromQuery
      .selectAll()
      .orderBy(column, 'asc')
      .limit(1)
      .executeTakeFirst()

    if (!model) return undefined

    return new ${modelName}Model(model)
  }

  static skip(count: number): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applySkip(count)
  }

  static take(count: number): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyTake(count)
  }

  static where<V = string>(column: keyof ${formattedTableName}Table, ...args: [V] | [Operator, V]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhere<V>(column, ...args)
  }

  static orWhere(...conditions: [string, any][]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyOrWhere(...conditions)
  }

  static whereNotIn<V = number>(column: keyof ${formattedTableName}Table, values: V[]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereNotIn<V>(column, values)
  }

  static whereBetween<V = number>(column: keyof ${formattedTableName}Table, range: [V, V]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereBetween<V>(column, range)
  }

  static whereRef(column: keyof ${formattedTableName}Table, ...args: string[]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereRef(column, ...args)
  }

  static when(condition: boolean, callback: (query: ${modelName}Model) => ${modelName}Model): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhen(condition, callback as any)
  }

  static whereNull(column: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereNull(column)
  }

  static whereNotNull(column: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereNotNull(column)
  }

  static whereLike(column: keyof ${formattedTableName}Table, value: string): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereLike(column, value)
  }

  static orderBy(column: keyof ${formattedTableName}Table, order: 'asc' | 'desc'): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyOrderBy(column, order)
  }

  static orderByAsc(column: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyOrderByAsc(column)
  }

  static orderByDesc(column: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyOrderByDesc(column)
  }

  static groupBy(column: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyGroupBy(column)
  }

  static having<V = string>(column: keyof ${formattedTableName}Table, operator: Operator, value: V): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyHaving<V>(column, operator, value)
  }

  static inRandomOrder(): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyInRandomOrder()
  }

  static whereColumn(first: keyof ${formattedTableName}Table, operator: Operator, second: keyof ${formattedTableName}Table): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereColumn(first, operator, second)
  }

  static async max(field: keyof ${formattedTableName}Table): Promise<number> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyMax(field)
  }

  static async min(field: keyof ${formattedTableName}Table): Promise<number> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyMin(field)
  }

  static async avg(field: keyof ${formattedTableName}Table): Promise<number> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyAvg(field)
  }

  static async sum(field: keyof ${formattedTableName}Table): Promise<number> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applySum(field)
  }

  static async count(): Promise<number> {
    const instance = new ${modelName}Model(undefined)

    return instance.applyCount()
  }

  static async get(): Promise<${modelName}Model[]> {
    const instance = new ${modelName}Model(undefined)

    const results = await instance.applyGet()

    return results.map((item: ${modelName}JsonResponse) => instance.createInstance(item))
  }

  static async pluck<K extends keyof ${modelName}Model>(field: K): Promise<${modelName}Model[K][]> {
    const instance = new ${modelName}Model(undefined)

    return await instance.applyPluck(field)
  }

  static async chunk(size: number, callback: (models: ${modelName}Model[]) => Promise<void>): Promise<void> {
    const instance = new ${modelName}Model(undefined)

    await instance.applyChunk(size, async (models) => {
      const modelInstances = models.map((item: ${modelName}JsonResponse) => instance.createInstance(item))
      await callback(modelInstances)
    })
  }

  static async paginate(options: { limit?: number, offset?: number, page?: number } = { limit: 10, offset: 0, page: 1 }): Promise<{
    data: ${modelName}Model[],
    paging: {
      total_records: number,
      page: number,
      total_pages: number
    },
    next_cursor: number | null
  }> {
    const instance = new ${modelName}Model(undefined)

    const result = await instance.applyPaginate(options)

    return {
      data: result.data.map((item: ${modelName}JsonResponse) => instance.createInstance(item)),
      paging: result.paging,
      next_cursor: result.next_cursor
    }
  }

  // Instance method for creating model instances
  createInstance(data: ${modelName}JsonResponse): ${modelName}Model {
    return new ${modelName}Model(data)
  }

  async applyCreate(new${modelName}: New${modelName}): Promise<${modelName}Model> {
    const filteredValues = Object.fromEntries(
      Object.entries(new${modelName}).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as New${modelName}

    await this.mapCustomSetters(filteredValues)

    ${uuidQuery}

    const result = await DB.instance.insertInto('${tableName}')
      .values(filteredValues)
      .executeTakeFirst()

    const model = await DB.instance.selectFrom('${tableName}')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ${modelName}')
    }

    ${mittCreateStatement}
    return this.createInstance(model)
  }

  async create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
    return await this.applyCreate(new${modelName})
  }

  static async create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
    const instance = new ${modelName}Model(undefined)
    return await instance.applyCreate(new${modelName})
  }

  static async firstOrCreate(search: Partial<${formattedTableName}Table>, values: New${modelName} = {} as New${modelName}): Promise<${modelName}Model> {
    // First try to find a record matching the search criteria
    const instance = new ${modelName}Model(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      return instance.createInstance(existingRecord)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as New${modelName}
    return await ${modelName}Model.create(createData)
  }

  static async updateOrCreate(search: Partial<${formattedTableName}Table>, values: New${modelName} = {} as New${modelName}): Promise<${modelName}Model> {
    // First try to find a record matching the search criteria
    const instance = new ${modelName}Model(undefined)

    // Apply all search conditions
    for (const [key, value] of Object.entries(search)) {
      instance.selectFromQuery = instance.selectFromQuery.where(key, '=', value)
    }

    // Try to find the record
    const existingRecord = await instance.applyFirst()

    if (existingRecord) {
      // If record exists, update it with the new values
      const model = instance.createInstance(existingRecord)
      const updatedModel = await model.update(values as ${modelName}Update)

      // Return the updated model instance
      if (updatedModel) {
        return updatedModel
      }

      // If update didn't return a model, fetch it again to ensure we have latest data
      const refreshedModel = await instance.applyFirst()
      return instance.createInstance(refreshedModel!)
    }

    // If no record exists, create a new one with combined search criteria and values
    const createData = { ...search, ...values } as New${modelName}
    return await ${modelName}Model.create(createData)
  }

  async update(new${modelName}: ${modelName}Update): Promise<${modelName}Model | undefined> {
    const filteredValues = Object.fromEntries(
      Object.entries(new${modelName}).filter(([key]) =>
        !this.guarded.includes(key) && this.fillable.includes(key)
      ),
    ) as ${modelName}Update

    await this.mapCustomSetters(filteredValues)

    filteredValues.updated_at = new Date().toISOString()

    await DB.instance.updateTable('${tableName}')
      .set(filteredValues)
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('${tableName}')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ${modelName}')
      }

      ${mittUpdateStatement}
      return this.createInstance(model)
    }

    return undefined
  }

  async forceUpdate(new${modelName}: ${modelName}Update): Promise<${modelName}Model | undefined> {
    await DB.instance.updateTable('${tableName}')
      .set(new${modelName})
      .where('id', '=', this.id)
      .executeTakeFirst()

    if (this.id) {
      // Get the updated data
      const model = await DB.instance.selectFrom('${tableName}')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ${modelName}')
      }

      ${mittUpdateStatement.replace('model', 'this')}
      return this.createInstance(model)
    }

    return undefined
  }

  async save(): Promise<${modelName}Model> {
    // If the model has an ID, update it; otherwise, create a new record
    if (this.id) {
      // Update existing record
      await DB.instance.updateTable('${tableName}')
        .set(this.attributes as ${modelName}Update)
        .where('id', '=', this.id)
        .executeTakeFirst()

      // Get the updated data
      const model = await DB.instance.selectFrom('${tableName}')
        .where('id', '=', this.id)
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve updated ${modelName}')
      }

      ${mittUpdateStatement.replace('model', 'this')}
      return this.createInstance(model)
    } else {
      // Create new record
      const result = await DB.instance.insertInto('${tableName}')
        .values(this.attributes as New${modelName})
        .executeTakeFirst()

      // Get the created data
      const model = await DB.instance.selectFrom('${tableName}')
        .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
        .selectAll()
        .executeTakeFirst()

      if (!model) {
        throw new HttpError(500, 'Failed to retrieve created ${modelName}')
      }

      ${mittCreateStatement.replace('model', 'this')}
      return this.createInstance(model)
    }
  }

  static async createMany(new${modelName}: New${modelName}[]): Promise<void> {
    const instance = new ${modelName}Model(undefined)

    const valuesFiltered = new${modelName}.map((new${modelName}: New${modelName}) => {
      const filteredValues = Object.fromEntries(
        Object.entries(new${modelName}).filter(([key]) =>
          !instance.guarded.includes(key) && instance.fillable.includes(key),
        ),
      ) as New${modelName}

      ${uuidQuery}

      return filteredValues
    })

    await DB.instance.insertInto('${tableName}')
      .values(valuesFiltered)
      .executeTakeFirst()
  }

  static async forceCreate(new${modelName}: New${modelName}): Promise<${modelName}Model> {
    const result = await DB.instance.insertInto('${tableName}')
      .values(new${modelName})
      .executeTakeFirst()

    const instance = new ${modelName}Model(undefined)
    const model = await DB.instance.selectFrom('${tableName}')
      .where('id', '=', Number(result.insertId || result.numInsertedOrUpdatedRows))
      .selectAll()
      .executeTakeFirst()

    if (!model) {
      throw new HttpError(500, 'Failed to retrieve created ${modelName}')
    }

    ${mittCreateStatement}

    return instance.createInstance(model)
  }

  // Method to remove a ${modelName}
  async delete(): Promise<number> {
    if (this.id === undefined)
      this.deleteFromQuery.execute()
    ${mittDeleteFindStatement}
    ${thisSoftDeleteStatementsUpdateFrom}
    ${mittDeleteStatement}

    const deleted = await DB.instance.deleteFrom('${tableName}')
      .where('id', '=', this.id)
      .execute()

    return deleted.numDeletedRows
  }

  static async remove(id: number): Promise<any> {
    ${removeInstanceStatment}

    ${mittDeleteStaticFindStatement}

    ${instanceSoftDeleteStatementsUpdateFrom}

    ${mittDeleteStatement}

    return await DB.instance.deleteFrom('${tableName}')
      .where('id', '=', id)
      .execute()
  }

  ${whereStatements}

  static whereIn<V = number>(column: keyof ${formattedTableName}Table, values: V[]): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyWhereIn<V>(column, values)
  }

  ${relationMethods}

  ${displayableStatements}

  ${billableStatements}

  ${likeableStatements}

  static distinct(column: keyof ${modelName}JsonResponse): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyDistinct(column)
  }

  static join(table: string, firstCol: string, secondCol: string): ${modelName}Model {
    const instance = new ${modelName}Model(undefined)

    return instance.applyJoin(table, firstCol, secondCol)
  }

  toJSON(): ${modelName}JsonResponse {
    const output = ${jsonFields}

    return output
  }

  parseResult(model: ${modelName}Model): ${modelName}Model {
    for (const hiddenAttribute of this.hidden) {
      delete model[hiddenAttribute as keyof ${modelName}Model]
    }

    return model
  }

  ${twoFactorStatements}

  // Add a protected applyFind implementation
  protected async applyFind(id: number): Promise<${modelName}Model | undefined> {
    const model = await DB.instance.selectFrom(this.tableName)
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!model)
      return undefined

    this.mapCustomGetters(model)

    await this.loadRelations(model)

    // Return a proper instance using the factory method
    return this.createInstance(model)
  }

  ${searchableStatements}
}

export async function find(id: number): Promise<${modelName}Model | undefined> {
  let query = DB.instance.selectFrom('${tableName}').where('id', '=', id).selectAll()

  const model = await query.executeTakeFirst()

  if (!model) return undefined

  const instance = new ${modelName}Model(undefined)
  return instance.createInstance(model)
}

export async function count(): Promise<number> {
  const results = await ${modelName}Model.count()

  return results
}

export async function create(new${modelName}: New${modelName}): Promise<${modelName}Model> {
  const instance = new ${modelName}Model(undefined)
  return await instance.applyCreate(new${modelName})
}

export async function rawQuery(rawQuery: string): Promise<any> {
  return await sql\`\${rawQuery}\`\.execute(DB.instance)
}

export async function remove(id: number): Promise<void> {
  await DB.instance.deleteFrom('${tableName}')
    .where('id', '=', id)
    .execute()
}

${whereFunctionStatements}

export const ${modelName} = ${modelName}Model

export default ${modelName}
`

  return classString
}
