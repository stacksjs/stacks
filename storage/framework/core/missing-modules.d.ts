// Type stubs for modules that are not installed locally or are optional dependencies.
// Shorthand declarations (no body) make all imports `any`.
// Explicit bodies are only used where code references types from modules (TS2709/TS2694).

// Cloud infrastructure (shorthand - accept any import)
declare module 'ts-cloud/aws' {
  export class S3Client { constructor(...args: any[]); [key: string]: any }
  export class SESClient { constructor(...args: any[]); [key: string]: any }
  export class DynamoDBClient { constructor(...args: any[]); [key: string]: any }
  export class Route53Client { constructor(...args: any[]); [key: string]: any }
  export class Route53DomainsClient { constructor(...args: any[]); [key: string]: any }
  export class AWSClient { constructor(...args: any[]); [key: string]: any }
  export class ACMClient { constructor(...args: any[]); [key: string]: any }
  export class CloudFormationClient { constructor(...args: any[]); [key: string]: any }
  export class CloudFrontClient { constructor(...args: any[]); [key: string]: any }
  export class CloudWatchLogsClient { constructor(...args: any[]); [key: string]: any }
  export class ConnectClient { constructor(...args: any[]); [key: string]: any }
  export class PinpointClient { constructor(...args: any[]); [key: string]: any }
  export type HostedZone = any
  export type CreateHostedZoneResult = any
  const _default: any
  export default _default
}
declare module 'ts-cloud/src/generators/infrastructure'
declare module 'ts-cloud/src/aws/cloudformation'
declare module 'ts-cloud/src/aws/cloudfront'
declare module 'ts-cloud/src/aws/s3'

// ts-cloud types (needs explicit type exports to avoid TS2709)
declare module '@ts-cloud/types' {
  export type CloudConfig = any
  export type TsCloudConfig = any
  export type CloudProvider = any
  export type EnvironmentType = any
  const _default: any
  export default _default
}

// AWS CDK - needs namespace exports for CDK construct patterns
declare module 'aws-cdk-lib' {
  // Top-level classes
  export class Stack { constructor(scope: any, id: string, props?: any); static of(scope: any): any; [key: string]: any }
  export class App { constructor(props?: any); [key: string]: any }
  export const Duration: any
  export const CfnOutput: any
  export class CfnResource { [key: string]: any }
  export const RemovalPolicy: any
  export const Fn: any
  export const Tags: any
  export const Size: any
  export const CustomResource: any
  export const Aws: any
  export type StackProps = any
  export const AssetHashType: any
  export const SecretValue: any

  // Submodule namespace + value declarations (merged)
  // These support both runtime usage (aws_iam.Role) and type usage (import type { aws_iam })
  export const aws_iam: any
  export namespace aws_iam {
    type Role = any
    type User = any
    type Group = any
    type Policy = any
    type PolicyStatement = any
    type ServicePrincipal = any
    type ManagedPolicy = any
    type Effect = any
    type AnyPrincipal = any
    type CfnServiceLinkedRole = any
    type IRole = any
    type IPrincipal = any
  }

  export const aws_s3: any
  export namespace aws_s3 {
    type Bucket = any
    type IBucket = any
    type BlockPublicAccess = any
    type BucketEncryption = any
    type BucketPolicy = any
    type EventType = any
    type ObjectOwnership = any
    type RedirectProtocol = any
    type StorageClass = any
  }

  export const aws_ec2: any
  export namespace aws_ec2 {
    type Vpc = any
    type IVpc = any
    type Instance = any
    type SecurityGroup = any
    type ISecurityGroup = any
    type InstanceType = any
    type InstanceClass = any
    type InstanceSize = any
    type IMachineImage = any
    type MachineImage = any
    type AmazonLinuxImage = any
    type AmazonLinuxCpuType = any
    type UserData = any
    type KeyPair = any
    type Port = any
    type Peer = any
    type SubnetType = any
    type IpAddresses = any
    type BlockDeviceVolume = any
    type EbsDeviceVolumeType = any
    type CfnEIP = any
    type BastionHostLinux = any
    type SubnetSelection = any
  }

  export const aws_ecs: any
  export namespace aws_ecs {
    type Cluster = any
    type ICluster = any
    type FargateTaskDefinition = any
    type FargateService = any
    type ContainerImage = any
    type CpuArchitecture = any
    type AwsLogDriver = any
    type TaskDefinition = any
  }

  export const aws_lambda: any
  export namespace aws_lambda {
    type Function = any
    type IFunction = any
    type FunctionUrl = any
    type Code = any
    type Runtime = any
    type CfnPermission = any
  }

  export const aws_rds: any

  export const aws_route53: any
  export namespace aws_route53 {
    type IHostedZone = any
    type PublicHostedZone = any
    type HostedZone = any
    type ARecord = any
    type MxRecord = any
    type TxtRecord = any
    type CnameRecord = any
    type CfnRecordSet = any
    type RecordTarget = any
  }

  export const aws_route53_targets: any
  export namespace aws_route53_targets {
    type BucketWebsiteTarget = any
    type CloudFrontTarget = any
  }

  export const aws_certificatemanager: any
  export namespace aws_certificatemanager {
    type Certificate = any
    type ICertificate = any
    type CertificateValidation = any
  }

  export const aws_cloudfront: any
  export namespace aws_cloudfront {
    type Distribution = any
    type IDistribution = any
    type CachePolicy = any
    type S3OriginAccessControl = any
    type OriginAccessIdentity = any
    type RealtimeLogConfig = any
    type CacheCookieBehavior = any
    type AllowedMethods = any
    type CachedMethods = any
    type HttpVersion = any
    type PriceClass = any
    type SecurityPolicyProtocol = any
    type ViewerProtocolPolicy = any
    type LambdaEdgeEventType = any
    type Signing = any
  }

  export const aws_cloudfront_origins: any
  export const aws_elasticache: any

  export const aws_s3_deployment: any
  export namespace aws_s3_deployment {
    type BucketDeployment = any
    type Source = any
  }

  export const aws_efs: any
  export namespace aws_efs {
    type FileSystem = any
    type IFileSystem = any
    type AccessPoint = any
    type LifecyclePolicy = any
    type PerformanceMode = any
    type ThroughputMode = any
  }

  export const aws_logs: any
  export namespace aws_logs {
    type LogGroup = any
    type ILogGroup = any
  }

  export const aws_sqs: any
  export const aws_sns: any

  export const aws_wafv2: any
  export namespace aws_wafv2 {
    type CfnIPSet = any
    interface CfnWebACL {
      [key: string]: any
    }
    namespace CfnWebACL {
      type RuleProperty = any
    }
  }

  export const aws_ses: any
  export const aws_ses_actions: any

  export const aws_secretsmanager: any
  export namespace aws_secretsmanager {
    type Secret = any
    type ISecret = any
  }

  export const aws_events: any
  export const aws_events_targets: any
  export const aws_stepfunctions: any
  export const aws_stepfunctions_tasks: any

  // Additional missing exports
  export const aws_backup: any
  export namespace aws_backup {
    type BackupVault = any
    type BackupPlan = any
    type BackupResource = any
  }

  export const aws_kms: any
  export namespace aws_kms {
    type Key = any
    type IKey = any
  }

  export const aws_s3_assets: any
  export namespace aws_s3_assets {
    type Asset = any
  }
  export const aws_s3_notifications: any

  export const aws_dynamodb: any
  export namespace aws_dynamodb {
    type Table = any
    type AttributeType = any
    type BillingMode = any
    type TableEncryption = any
  }
}

declare module 'aws-cdk-lib/aws-ecs' {
  export type Cluster = any
  export type FargateTaskDefinition = any
  export type FargateService = any
  export type ContainerImage = any
  export type TaskDefinition = any
  const _default: any
  export default _default
}
declare module 'aws-cdk-lib/aws-elasticloadbalancingv2' {
  export class ApplicationLoadBalancer { constructor(...args: any[]); [key: string]: any }
  export class ApplicationTargetGroup { constructor(...args: any[]); [key: string]: any }
  export const ListenerAction: any
  export const Protocol: any
  export const ApplicationProtocol: any
  export const TargetType: any
  const _default: any
  export default _default
}
declare module 'aws-cdk-lib/aws-events' {
  export const Rule: any
  export const Schedule: any
  const _default: any
  export default _default
}
declare module 'aws-cdk-lib/aws-events-targets' {
  export const EcsTask: any
  const _default: any
  export default _default
}
declare module 'aws-cdk-lib/aws-logs' {
  export const LogGroup: any
  const _default: any
  export default _default
}

// Constructs - needs explicit class export
declare module 'constructs' {
  export class Construct { constructor(scope: any, id: string); [key: string]: any }
}

// AWS SDK clients - explicit type exports for modules used with `import type`
declare module '@aws-sdk/client-route-53-domains' {
  export type CountryCode = any
  export const ContactType: any
  export type RegisterDomainCommandOutput = any
  export class Route53DomainsClient { constructor(config?: any); send(command: any): Promise<any> }
  export class Route53Domains { constructor(config?: any); [key: string]: any }
  export class RegisterDomainCommand { constructor(input: any) }
  export class CheckDomainAvailabilityCommand { constructor(input: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient { constructor(config?: any); send(command: any): Promise<any> }
  export class CreateModelCustomizationJobCommand { constructor(input: any) }
  export type CreateModelCustomizationJobCommandInput = any
  export type CreateModelCustomizationJobCommandOutput = any
  export class GetModelCustomizationJobCommand { constructor(input: any) }
  export type GetModelCustomizationJobCommandInput = any
  export type GetModelCustomizationJobCommandOutput = any
  export class ListFoundationModelsCommand { constructor(input: any) }
  export type ListFoundationModelsCommandInput = any
  export type ListFoundationModelsCommandOutput = any
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient { constructor(config?: any); send(command: any): Promise<any> }
  export type InvokeModelCommandInput = any
  export type InvokeModelCommandOutput = any
  export class InvokeModelCommand { constructor(input: any) }
  export type InvokeModelWithResponseStreamCommandInput = any
  export type InvokeModelWithResponseStreamCommandOutput = any
  export class InvokeModelWithResponseStreamCommand { constructor(input: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-cloudformation' {
  export class CloudFormationClient { constructor(config?: any); send(command: any): Promise<any> }
  export class CloudFormation { constructor(config?: any); [key: string]: any }
  export class DescribeStacksCommand { constructor(input?: any) }
  export class ListStacksCommand { constructor(input?: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-cloudwatch-logs' {
  export class CloudWatchLogsClient { constructor(config?: any); send(command: any): Promise<any> }
  export class DescribeLogGroupsCommand { constructor(input?: any) }
  export class DeleteLogGroupCommand { constructor(input?: any) }
  export type DescribeLogGroupsCommandOutput = any
  export class GetLogEventsCommand { constructor(input?: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-ec2' {
  export class EC2Client { constructor(config?: any); send(command: any): Promise<any> }
  export class EC2 { constructor(config?: any); [key: string]: any }
  export class DeleteNetworkInterfaceCommand { constructor(input: any) }
  export class DeleteSubnetCommand { constructor(input: any) }
  export class DeleteVpcCommand { constructor(input: any) }
  export class DescribeNetworkInterfacesCommand { constructor(input?: any) }
  export class DescribeRegionsCommand { constructor(input?: any) }
  export class DescribeSubnetsCommand { constructor(input?: any) }
  export class DescribeVpcsCommand { constructor(input?: any) }
  export class DetachNetworkInterfaceCommand { constructor(input: any) }
  export class TerminateInstancesCommand { constructor(input: any) }
  export const _InstanceType: any
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-efs' {
  export class EFSClient { constructor(config?: any); send(command: any): Promise<any> }
  export class DescribeFileSystemsCommand { constructor(input?: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-iam' {
  export class IAMClient { constructor(config?: any); send(command: any): Promise<any> }
  export class IAM { constructor(config?: any); [key: string]: any }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-lambda' {
  export class LambdaClient { constructor(config?: any); send(command: any): Promise<any> }
  export class Lambda { constructor(config?: any); [key: string]: any }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-ssm' {
  export class SSMClient { constructor(config?: any); send(command: any): Promise<any> }
  export class SSM { constructor(config?: any); [key: string]: any }
  export class PutParameterCommand { constructor(input: any) }
  export type SetOptions = any
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-ses' {
  export class SESClient { constructor(config?: any); send(command: any): Promise<any> }
  export class SES { constructor(config?: any); [key: string]: any }
  export class SendEmailCommand { constructor(input: any) }
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-cloudfront' {
  export class CloudFrontClient { constructor(config?: any); send(command: any): Promise<any> }
  export type S3Client = any
  const _default: any
  export default _default
}

declare module '@aws-sdk/client-route-53' {
  export class Route53Client { constructor(config?: any); send(command: any): Promise<any> }
  export type HostedZone = any
  export type CreateHostedZoneResult = any
  const _default: any
  export default _default
}

// Broadcasting - needs explicit type exports for TS2709 + all exports used via re-export
declare module 'ts-broadcasting' {
  // Types needed in type-position
  export type BroadcastServer = any
  export type BroadcastEvent = any
  export type ChannelType = any
  export type ServerConfig = any
  export type BroadcastChannel = any
  export type BroadcastConfig = any
  export type BroadcastMessage = any
  export type ConnectionConfig = any
  export type ConnectionOptions = any
  export type ChannelAuthCallback = any
  export type PresenceMember = any
  export type QueueConfig = any
  export type WebSocketData = any

  // Classes and values
  export const AcknowledgmentManager: any
  export const AnonymousEvent: any
  export const AuthenticationManager: any
  export const BatchOperationsManager: any
  export const Broadcast: any
  export const BroadcastHelpers: any
  export const BroadcastJob: any
  export const BroadcastQueueManager: any
  export const Broadcaster: any
  export const Channel: any
  export const ChannelManager: any
  export const CircuitBreaker: any
  export const CircuitBreakerError: any
  export const CircuitBreakerManager: any
  export const Client: any
  export const DelayedBroadcastJob: any
  export const Echo: any
  export const EncryptionManager: any
  export const LoadManager: any
  export const MessageDeduplicator: any
  export const MessageValidationManager: any
  export const MonitoringManager: any
  export const PersistenceManager: any
  export const PresenceChannel: any
  export const PresenceHeartbeatManager: any
  export const PrivateChannel: any
  export const PrometheusExporter: any
  export const RateLimiter: any
  export const RecurringBroadcastJob: any
  export const RedisAdapter: any
  export const SecurityManager: any
  export const User: any
  export const WebhookManager: any

  // Functions
  export function createServer(config?: any): any
  export function broadcast(event: any, data?: any): any
  export function broadcastToUser(user: any, event: any, data?: any): any
  export function broadcastToUsers(users: any, event: any, data?: any): any
  export const BroadcastClient: any
  export function channel(name: string): any
  export function createEvent(name: string, data?: any): any
  export function createHelpers(server?: any): any

  const _default: any
  export default _default
}

// Security (shorthand)
declare module 'ts-security-crypto'

// Markdown (shorthand)
declare module 'ts-md'

// Dependencies/pantry (shorthand)
declare module 'ts-pantry'

// Vue ecosystem (shorthand)
declare module '@headlessui/vue'
declare module 'vite-plugin-inspect' {
  export type Options = any
  const _default: any
  export default _default
}
declare module 'vite-plugin-pwa' {
  export type Options = any
  const _default: any
  export default _default
}
declare module 'vue-router'
declare module 'vue-router/auto-routes'

// vite - needs explicit types for TS2709
declare module 'vite' {
  export type PluginOption = any
  export type Plugin = any
  export type UserConfig = any
  export type ResolvedConfig = any
  export type ViteDevServer = any
  export function defineConfig(config: any): any
  export function createServer(config?: any): Promise<any>
  export function build(config?: any): Promise<any>
  const _default: any
  export default _default
}

// vite-ssg - needs explicit types for TS2709
declare module 'vite-ssg' {
  export type ViteSSGContext = any
  export function ViteSSG(app: any, routes: any, fn?: any): any
  const _default: any
  export default _default
}

// vue-component-meta needs explicit types (TS2709)
declare module 'vue-component-meta' {
  export function createChecker(tsconfig: string): any
  export function createComponentMetaChecker(tsconfig: string, options?: any): any
  export type MetaCheckerOptions = any
  export type ComponentMeta = any
}

// vue-docgen-web-types needs explicit type (TS2709)
declare module 'vue-docgen-web-types/types/config' {
  export type WebTypesBuilderConfig = any
  const _default: any
  export default _default
}

declare module 'virtual:generated-layouts'
declare module 'virtual:uno.css'
declare module 'pinia'
declare module 'unplugin-vue-components'

// Bun plugins
declare module 'bun-plugin-stx/serve'

// bun-plugin-auto-imports - needs explicit type (TS2709)
declare module 'bun-plugin-auto-imports' {
  export type AutoImportsOptions = any
  export function autoImports(options?: any): any
  export function generateGlobalsScript(options?: any): any
  export function generateRuntimeIndex(options?: any): any
  const _default: any
  export default _default
}

declare module 'unplugin-auto-import/types' {
  export type Options = any
  const _default: any
  export default _default
}

// bun-plugin-dtsx - fix PluginConfig to accept root/outdir
declare module 'bun-plugin-dtsx' {
  export function dts(options?: any): any
  export type DtsGenerationOption = any
  const _default: any
  export default _default
}

// Queue - needs explicit types for TS2709 + all exports used via re-export
declare module 'bun-queue' {
  // Types needed in type-position
  export class BunQueue<T = any> { constructor(...args: any[]); [key: string]: any }
  export class BunJob<T = any> { [key: string]: any }
  export type BunJobOptions = any
  export type JobOptions = any
  export type QueueOptions = any
  export type WorkerOptions = any
  export type JobEvents = any

  // Classes and values
  export const Queue: any
  export const Job: any
  export const JobBase: any
  export const Worker: any
  export const WorkerManager: any
  export const QueueManager: any
  export const QueueWorker: any
  export const QueueGroup: any
  export const QueueObservable: any
  export const JobProcessor: any
  export const BatchProcessor: any
  export const PriorityQueue: any
  export const DeadLetterQueue: any
  export const DistributedLock: any
  export const LeaderElection: any
  export const WorkCoordinator: any
  export const FailedJob: any
  export const FailedJobManager: any
  export const RateLimiter: any

  // Middleware
  export const FailureMiddleware: any
  export const RateLimitMiddleware: any
  export const SkipIfMiddleware: any
  export const ThrottleMiddleware: any
  export const UniqueJobMiddleware: any
  export const WithoutOverlappingMiddleware: any
  export const middleware: any

  // Functions
  export function createQueue(name: string, options?: any): any
  export function createJobProcessor(options?: any): any
  export function dispatch(job: any, ...args: any[]): any
  export function dispatchSync(job: any, ...args: any[]): any
  export function dispatchAfter(delay: any, job: any, ...args: any[]): any
  export function dispatchIf(condition: any, job: any, ...args: any[]): any
  export function dispatchUnless(condition: any, job: any, ...args: any[]): any
  export function dispatchChain(jobs: any[]): any
  export function dispatchFunction(fn: any, ...args: any[]): any
  export function batch(jobs: any[]): any
  export function chain(jobs: any[]): any
  export function getQueueManager(): any
  export function setQueueManager(manager: any): void
  export function closeQueueManager(): any
  export function getGlobalJobProcessor(): any
  export function setGlobalJobProcessor(processor: any): void

  const _default: any
  export default _default
}

// Desktop (shorthand)
declare module '@tauri-apps/api'

// CSS/UI
declare module 'headwind' {
  export type HeadwindOptions = any
  export type HeadwindConfig = any
  const _default: any
  export default _default
}
declare module '@stacksjs/headwind'

// cz-git needs explicit type (TS2709)
declare module 'cz-git' {
  export type UserConfig = any
  const _default: any
  export default _default
}

// Utilities (shorthand)
declare module 'crypto-js/md5'
declare module 'filesize'
declare module 'markdown-table'
declare module 'qrcode'

// Augment bun-query-builder to add missing properties used in codebase
declare module 'bun-query-builder' {
  interface QueryBuilder<DB> {
    fn: {
      count<T = number>(column: string): { as(alias: string): any }
      sum<T = number>(column: string): { as(alias: string): any }
      avg<T = number>(column: string): { as(alias: string): any }
      min<T = number>(column: string): { as(alias: string): any }
      max<T = number>(column: string): { as(alias: string): any }
      coalesce(...args: any[]): any
    }
    schema: any
    selectFrom(table: string): any
    insertInto(table: string): any
    updateTable(table: string): any
    deleteFrom(table: string): any
    [key: string]: any
  }

  // Missing exports in type declarations
  export function setConfig(config: any): void
  export function createQueryBuilder(config?: any): QueryBuilder<any>
  export type QueryBuilderConfig = any
  export const sql: any
  export type SupportedDialect = 'sqlite' | 'mysql' | 'postgres'
  export type DatabaseSchema<T = any> = any
  export type Seeder = any
  export function executeMigration(options: any, config?: any): Promise<any>
  export function generateMigration(options: any, config?: any): Promise<any>
  export function buildDatabaseSchema(options?: any): any
  export function buildSchemaMeta(options?: any): any
  export function defineModels(options?: any): any
  export function resetConnection(): void
  export function resetDatabase(options?: any, config?: any): Promise<any>
  export const config: any

  // Browser-related (not shipped in current version, stub them)
  export type BrowserConfig = any
  export type BrowserModelDefinition = any
  export type BrowserModelInstance = any
  export type BrowserModelQueryBuilder = any
  export const BrowserQueryBuilder: any
  export const BrowserQueryError: any
  export type BrowserTypedAttribute = any
  export function browserAuth(options?: any): any
  export function browserQuery(options?: any): any
  export function configureBrowser(config?: any): any
  export function createBrowserDb(options?: any): any
  export function createBrowserModel(options?: any): any
  export function getBrowserConfig(): any
  export function isBrowser(): boolean
}

// CAC augmentation is in cac-augment.d.ts (must be a module file to augment rather than replace)

// CSS imports
declare module '*.css'
