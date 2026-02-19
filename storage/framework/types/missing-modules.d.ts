// Type stubs for external packages not installed in the monorepo.
// These packages are optional dependencies used in specific deployment
// or feature contexts (cloud, UI, build tooling, etc.).

// ============================================================================
// Cloud / AWS CDK (not installed — used in @stacksjs/cloud for IaC)
// ============================================================================

declare module 'aws-cdk-lib' {
  import { Construct } from 'constructs'
  export class Stack extends Construct { constructor(scope?: Construct | any, id?: string, props?: any); [key: string]: any }
  export const App: any
  export const Duration: any
  export const RemovalPolicy: any
  export const CfnOutput: any
  export const Fn: any
  export const Tags: any
  export const SecretValue: any
  export const Size: any
  export class CfnResource { constructor(...args: any[]); [key: string]: any }
  export const AssetHashType: any
  export type StackProps = any
  export type Construct = any

  export namespace aws_iam {
    class Role { constructor(...args: any[]); [key: string]: any }
    class ServicePrincipal { constructor(...args: any[]); [key: string]: any }
    class ManagedPolicy { constructor(...args: any[]); static fromAwsManagedPolicyName(name: string): any; [key: string]: any }
    class PolicyStatement { constructor(...args: any[]); [key: string]: any }
    class Group { constructor(...args: any[]); [key: string]: any }
    class User { constructor(...args: any[]); [key: string]: any }
    class Policy { constructor(...args: any[]); [key: string]: any }
    const Effect: any
  }

  export namespace aws_s3 {
    class Bucket { constructor(...args: any[]); [key: string]: any }
    interface IBucket { [key: string]: any }
    const BucketEncryption: any
    const BlockPublicAccess: any
    const ObjectOwnership: any
    const RedirectProtocol: any
    const StorageClass: any
    const EventType: any
  }

  export namespace aws_s3_assets {
    class Asset { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_s3_deployment {
    class BucketDeployment { constructor(...args: any[]); [key: string]: any }
    const Source: any
  }

  export namespace aws_s3_notifications {
    class LambdaDestination { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_ec2 {
    class Vpc { constructor(...args: any[]); [key: string]: any }
    class SecurityGroup { constructor(...args: any[]); [key: string]: any }
    class Instance { constructor(...args: any[]); [key: string]: any }
    class KeyPair { constructor(...args: any[]); [key: string]: any }
    class CfnEIP { constructor(...args: any[]); [key: string]: any }
    const IpAddresses: any
    const SubnetType: any
    const Peer: any
    const Port: any
    class InstanceType { constructor(...args: any[]); [key: string]: any }
    const InstanceClass: any
    const InstanceSize: any
    const AmazonLinuxImage: any
    const MachineImage: any
    const AmazonLinuxCpuType: any
    const EbsDeviceVolumeType: any
    const BlockDeviceVolume: any
    class UserData { static forLinux(options?: any): UserData; static forWindows(options?: any): UserData; addCommands(...commands: string[]): void; addS3DownloadCommand(params: any): string; render(): string; [key: string]: any }
    type IMachineImage = any
  }

  export namespace aws_ecs {
    class Cluster { constructor(...args: any[]); [key: string]: any }
    class FargateTaskDefinition { constructor(...args: any[]); [key: string]: any }
    class FargateService { constructor(...args: any[]); [key: string]: any }
    const CpuArchitecture: any
    const ContainerImage: any
    const AwsLogDriver: any
  }

  export namespace aws_efs {
    class FileSystem { constructor(...args: any[]); [key: string]: any }
    class AccessPoint { constructor(...args: any[]); [key: string]: any }
    const LifecyclePolicy: any
    const PerformanceMode: any
    const ThroughputMode: any
  }

  export namespace aws_lambda {
    class Function { constructor(...args: any[]); [key: string]: any }
    class FunctionUrl { constructor(...args: any[]); [key: string]: any }
    class CfnPermission { constructor(...args: any[]); [key: string]: any }
    const Runtime: any
    const Code: any
  }

  export namespace aws_cloudfront {
    class Distribution { constructor(...args: any[]); [key: string]: any }
    class OriginAccessIdentity { constructor(...args: any[]); [key: string]: any }
    class CachePolicy { constructor(...args: any[]); [key: string]: any }
    class S3OriginAccessControl { constructor(...args: any[]); [key: string]: any }
    class RealtimeLogConfig { constructor(...args: any[]); [key: string]: any }
    const Signing: any
    const HttpVersion: any
    const PriceClass: any
    const SecurityPolicyProtocol: any
    const LambdaEdgeEventType: any
    const ViewerProtocolPolicy: any
    class CacheCookieBehavior { static none(): CacheCookieBehavior; static all(): CacheCookieBehavior; static allowList(...cookies: string[]): CacheCookieBehavior; [key: string]: any }
    class AllowedMethods { static ALLOW_ALL: AllowedMethods; static ALLOW_GET_HEAD: AllowedMethods; static ALLOW_GET_HEAD_OPTIONS: AllowedMethods; [key: string]: any }
    class CachedMethods { static CACHE_GET_HEAD: CachedMethods; static CACHE_GET_HEAD_OPTIONS: CachedMethods; [key: string]: any }
  }

  export namespace aws_cloudfront_origins {
    class S3StaticWebsiteOrigin { constructor(...args: any[]); [key: string]: any }
    class S3Origin { constructor(...args: any[]); [key: string]: any }
    class HttpOrigin { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_route53 {
    class PublicHostedZone { constructor(...args: any[]); [key: string]: any }
    class ARecord { constructor(...args: any[]); [key: string]: any }
    class CnameRecord { constructor(...args: any[]); [key: string]: any }
    class MxRecord { constructor(...args: any[]); [key: string]: any }
    class TxtRecord { constructor(...args: any[]); [key: string]: any }
    class CfnRecordSet { constructor(...args: any[]); [key: string]: any }
    const RecordTarget: any
    const HostedZone: any
    type IHostedZone = any
  }

  export namespace aws_route53_targets {
    class BucketWebsiteTarget { constructor(...args: any[]); [key: string]: any }
    class CloudFrontTarget { constructor(...args: any[]); [key: string]: any }
    class LoadBalancerTarget { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_certificatemanager {
    class Certificate { constructor(...args: any[]); [key: string]: any }
    const CertificateValidation: any
  }

  export namespace aws_wafv2 {
    class CfnWebACL { constructor(...args: any[]); [key: string]: any }
    class CfnIPSet { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_kms {
    class Key { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_ses {
    class CfnReceiptRuleSet { constructor(...args: any[]); [key: string]: any }
    class CfnReceiptRule { constructor(...args: any[]); [key: string]: any }
    class CfnEmailIdentity { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_secretsmanager {
    class Secret { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_backup {
    class BackupVault { constructor(...args: any[]); [key: string]: any }
    class BackupPlan { constructor(...args: any[]); [key: string]: any }
    class BackupResource { constructor(...args: any[]); [key: string]: any }
  }

  export namespace aws_dynamodb {
    class Table { constructor(...args: any[]); [key: string]: any }
    const AttributeType: any
    const BillingMode: any
    const TableEncryption: any
  }
}

declare module 'aws-cdk-lib/aws-elasticloadbalancingv2' {
  export class ApplicationLoadBalancer { constructor(...args: any[]); [key: string]: any }
  export class ApplicationTargetGroup { constructor(...args: any[]); [key: string]: any }
  export const ApplicationProtocol: any
  export class ApplicationListener { constructor(...args: any[]); [key: string]: any }
  export const ListenerAction: any
  export const TargetType: any
  export const Protocol: any
}

declare module 'aws-cdk-lib/aws-ecs' {
  export class Cluster { constructor(...args: any[]); [key: string]: any }
  export class FargateService { constructor(...args: any[]); [key: string]: any }
  export class FargateTaskDefinition { constructor(...args: any[]); [key: string]: any }
  export class TaskDefinition { constructor(...args: any[]); [key: string]: any }
  export const ContainerImage: any
  export const LogDriver: any
  export const Protocol: any
}

declare module 'aws-cdk-lib/aws-logs' {
  export class LogGroup { constructor(...args: any[]); [key: string]: any }
  export const RetentionDays: any
}

declare module 'aws-cdk-lib/aws-events' {
  export const Rule: any
  export const Schedule: any
}

declare module 'aws-cdk-lib/aws-events-targets' {
  export const LambdaFunction: any
  export const EcsTask: any
}

declare module 'constructs' {
  export class Construct {
    constructor(scope: any, id: string)
    node: any
  }
}

// ============================================================================
// AWS SDK clients (not installed — ts-cloud provides its own implementations)
// ============================================================================

declare module '@aws-sdk/client-route-53-domains' {
  export class Route53DomainsClient { constructor(config?: any); send(command: any): Promise<any> }
  export class CheckDomainAvailabilityCommand { constructor(input: any) }
  export class RegisterDomainCommand { constructor(input: any) }
  export class GetDomainDetailCommand { constructor(input: any) }
  export const ContactType: { [key: string]: string }
  export class CountryCode { static readonly [key: string]: CountryCode; readonly [key: string]: string }
  export type RegisterDomainCommandOutput = any
}

declare module '@aws-sdk/client-cloudwatch-logs' {
  export class CloudWatchLogsClient { constructor(config?: any); send(command: any): Promise<any> }
  export class GetLogEventsCommand { constructor(input: any) }
  export class FilterLogEventsCommand { constructor(input: any) }
  export class DeleteLogGroupCommand { constructor(input: any) }
  export class DescribeLogGroupsCommand { constructor(input: any) }
  export type DescribeLogGroupsCommandOutput = any
}

declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient { constructor(config?: any); send(command: any): Promise<any> }
  export class ListFoundationModelsCommand { constructor(input?: any) }
  export class CreateModelCustomizationJobCommand { constructor(input: any) }
  export class GetModelCustomizationJobCommand { constructor(input: any) }
  export type ListFoundationModelsCommandInput = any
  export type ListFoundationModelsCommandOutput = any
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient { constructor(config?: any); send(command: any): Promise<any> }
  export class InvokeModelCommand { constructor(input: any) }
  export class InvokeModelWithResponseStreamCommand { constructor(input: any) }
  export type InvokeModelCommandInput = any
  export type InvokeModelCommandOutput = any
}

declare module '@aws-sdk/client-ssm' {
  export class SSMClient { constructor(config?: any); send(command: any): Promise<any> }
  export class GetParameterCommand { constructor(input: any) }
  export class PutParameterCommand { constructor(input: any) }
}

declare module '@aws-sdk/client-lambda' {
  export class LambdaClient { constructor(config?: any); send(command: any): Promise<any> }
  export class InvokeCommand { constructor(input: any) }
}

declare module '@aws-sdk/client-iam' {
  export class IAMClient { constructor(config?: any); send(command: any): Promise<any> }
}

declare module '@aws-sdk/client-efs' {
  export class EFSClient { constructor(config?: any); send(command: any): Promise<any> }
  export class DescribeFileSystemsCommand { constructor(input?: any) }
}

declare module '@aws-sdk/client-ec2' {
  export class EC2Client { constructor(config?: any); send(command: any): Promise<any> }
  export class DescribeRegionsCommand { constructor(input?: any) }
  export class DescribeVpcsCommand { constructor(input?: any) }
  export class DescribeSubnetsCommand { constructor(input?: any) }
  export class DescribeNetworkInterfacesCommand { constructor(input?: any) }
  export class DeleteVpcCommand { constructor(input: any) }
  export class DeleteSubnetCommand { constructor(input: any) }
  export class DeleteNetworkInterfaceCommand { constructor(input: any) }
  export class DetachNetworkInterfaceCommand { constructor(input: any) }
  export class TerminateInstancesCommand { constructor(input: any) }
  export const _InstanceType: any
}

declare module '@aws-sdk/client-cloudformation' {
  export class CloudFormationClient { constructor(config?: any); send(command: any): Promise<any> }
  export class DescribeStacksCommand { constructor(input: any) }
}

// ============================================================================
// Broadcasting (not installed — optional runtime dependency)
// ============================================================================

declare module 'ts-broadcasting' {
  export class Broadcaster { constructor(config?: any); channel(name: string): any; private(name: string): any; presence(name: string): any }
  export class BroadcastServer { constructor(config?: any); start(): Promise<void>; stop(): Promise<void>; [key: string]: any }
  export class BroadcastEvent { constructor(data?: any); [key: string]: any }
  export function broadcast(channel: string, event: string, data?: any): void
  export type BroadcastConfig = any
  export type ChannelType = any
  export type ServerConfig = any
}

// ============================================================================
// UI (not installed — optional Vue UI components)
// ============================================================================

declare module '@headlessui/vue' {
  import type { Component } from 'vue'
  export const Dialog: Component
  export const DialogPanel: Component
  export const DialogTitle: Component
  export const DialogDescription: Component
  export const Menu: Component
  export const MenuButton: Component
  export const MenuItems: Component
  export const MenuItem: Component
  export const Transition: Component
  export const TransitionChild: Component
  export const TransitionRoot: Component
  export const Listbox: Component
  export const ListboxButton: Component
  export const ListboxOptions: Component
  export const ListboxOption: Component
  export const Switch: Component
  export const SwitchGroup: Component
  export const SwitchLabel: Component
  export const Tab: Component
  export const TabGroup: Component
  export const TabList: Component
  export const TabPanel: Component
  export const TabPanels: Component
  export const Disclosure: Component
  export const DisclosureButton: Component
  export const DisclosurePanel: Component
  export const Popover: Component
  export const PopoverButton: Component
  export const PopoverPanel: Component
  export const RadioGroup: Component
  export const RadioGroupLabel: Component
  export const RadioGroupOption: Component
  export const RadioGroupDescription: Component
  export const Combobox: Component
  export const ComboboxInput: Component
  export const ComboboxButton: Component
  export const ComboboxOptions: Component
  export const ComboboxOption: Component
}

declare module 'headwind' {
  export type HeadwindOptions = any
  const content: any
  export default content
}

declare module '@stacksjs/headwind' {
  const content: any
  export default content
}

// ============================================================================
// Security (not installed — optional crypto dependency)
// ============================================================================

declare module 'ts-security-crypto' {
  export function encrypt(data: string, key?: string): string
  export function decrypt(data: string, key?: string): string
  export function hash(data: string, algorithm?: string): string
  export function verifyHash(data: string, hash: string): boolean
  export function generateKey(length?: number): string
  export function base64Decode(data: string): string
  export function base64Encode(data: string): string
  export function hashPassword(password: string, options?: any): Promise<string>
  export function verifyPassword(password: string, hash: string): Promise<boolean>
  export function md5(data: string): string
}

// ============================================================================
// Build tools (not installed — optional build-time dependencies)
// ============================================================================

declare module 'bun-plugin-stx/serve' {
  export function serve(options?: any): any
  export function stxServe(options?: any): any
  export function createStxServer(options?: any): any
  export const stxPlugin: any
}

declare module 'vite' {
  export function defineConfig(config: any): any
  export function createServer(config?: any): Promise<any>
  export function build(config?: any): Promise<any>
  export type Plugin = any
  export type UserConfig = any
  export type ResolvedConfig = any
}

declare module 'vite-ssg' {
  export function ViteSSG(app: any, options?: any): any
  export type ViteSSGContext = any
}

declare module 'vite-plugin-pwa' {
  export function VitePWA(options?: any): any
  export type Options = any
}

declare module 'vite-plugin-inspect' {
  export default function Inspect(options?: any): any
  export type Options = any
}

declare module 'unplugin-vue-components' {
  export default function Components(options?: any): any
  export type Options = any
}

declare module 'unplugin-auto-import/types' {
  export type Options = any
}

// ============================================================================
// Vue tooling (not installed — optional dev-time dependencies)
// ============================================================================

declare module 'vue-component-meta' {
  export function createComponentMetaChecker(tsConfigPath: string, options?: any): any
  export type ComponentMeta = any
}

declare module 'vue-docgen-web-types/types/config' {
  export type WebTypesBuilderConfig = any
}

// ============================================================================
// Misc utilities (not installed — optional runtime dependencies)
// ============================================================================

declare module 'ts-md' {
  export function render(markdown: string): string
  export function parse(markdown: string): any
  export function parseMarkdown(markdown: string): any
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>
  export function toString(text: string, options?: any): Promise<string>
  export function toCanvas(canvas: any, text: string, options?: any): Promise<void>
}

declare module 'markdown-table' {
  export function markdownTable(table: string[][], options?: any): string
}

declare module 'filesize' {
  export function filesize(bytes: number, options?: any): string
  export default function (bytes: number, options?: any): string
}

declare module 'crypto-js/md5' {
  export default function md5(message: string): any
}

declare module 'bun-queue' {
  import type { Faker } from 'ts-mocker'
  export class Queue<T = any> { constructor(name: string, options?: any); add(data: T, options?: any): Promise<any>; process(handler: (job: Job<T>) => Promise<any>): void; on(event: string, handler: (...args: any[]) => void): void; [key: string]: any }
  export class QueueManager { constructor(options?: any); [key: string]: any }
  export class QueueWorker { constructor(options?: any); [key: string]: any }
  export class Worker { constructor(options?: any); [key: string]: any }
  export class WorkerManager { constructor(options?: any); [key: string]: any }
  export class WorkCoordinator { constructor(options?: any); [key: string]: any }
  export class Job<T = any> { constructor(data?: T); data: T; id: string | number; [key: string]: any }
  export class JobBase { constructor(data?: any); [key: string]: any }
  export class JobProcessor { constructor(options?: any); [key: string]: any }
  export class FailedJob { constructor(data?: any); [key: string]: any }
  export class FailedJobManager { constructor(options?: any); [key: string]: any }
  export class PriorityQueue { constructor(options?: any); [key: string]: any }
  export class QueueGroup { constructor(options?: any); [key: string]: any }
  export class QueueObservable { constructor(options?: any); [key: string]: any }
  export class DeadLetterQueue { constructor(options?: any); [key: string]: any }
  export class BatchProcessor { constructor(options?: any); [key: string]: any }
  export class RateLimiter { constructor(options?: any); [key: string]: any }
  export class LeaderElection { constructor(options?: any); [key: string]: any }
  export class DistributedLock { constructor(options?: any); [key: string]: any }
  export type WorkerOptions = any
  export type JobEvents = any
  export function dispatch(job: any, options?: any): Promise<any>
  export function dispatchSync(job: any): Promise<any>
  export function dispatchAfter(delay: number, job: any): Promise<any>
  export function dispatchIf(condition: boolean, job: any): Promise<any>
  export function dispatchUnless(condition: boolean, job: any): Promise<any>
  export function dispatchChain(jobs: any[]): Promise<any>
  export function dispatchFunction(fn: Function, options?: any): Promise<any>
  export function batch(jobs: any[]): any
  export function chain(jobs: any[]): any
  export function getQueueManager(): any
  export function setQueueManager(manager: any): void
  export function closeQueueManager(): Promise<void>
  export function getGlobalJobProcessor(): any
  export function setGlobalJobProcessor(processor: any): void
  export function createJobProcessor(options?: any): any
  export const middleware: {
    RateLimitMiddleware: any
    ThrottleMiddleware: any
    UniqueJobMiddleware: any
    WithoutOverlappingMiddleware: any
    SkipIfMiddleware: any
    FailureMiddleware: any
  }
  export const RateLimitMiddleware: any
  export const ThrottleMiddleware: any
  export const UniqueJobMiddleware: any
  export const WithoutOverlappingMiddleware: any
  export const SkipIfMiddleware: any
  export const FailureMiddleware: any
}

declare module '@tauri-apps/api' {
  export const invoke: (cmd: string, args?: any) => Promise<any>
  export const event: any
  export const window: any
  export const app: any
  export const core: any
  export const dpi: any
  export const image: any
  export const menu: any
  export const mocks: any
  export const path: any
  export const tray: any
  export const webview: any
  export const webviewWindow: any
}
