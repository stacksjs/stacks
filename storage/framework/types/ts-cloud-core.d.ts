declare module 'ts-cloud-core' {
  export interface IntrinsicFunctions {
    Ref: (logicalName: string) => { Ref: string }
    GetAtt: (logicalName: string, attributeName: string) => { 'Fn::GetAtt': [string, string] }
    Sub: (template: string, variables?: Record<string, any>) => { 'Fn::Sub': string | [string, Record<string, any>] }
    Join: (delimiter: string, values: any[]) => { 'Fn::Join': [string, any[]] }
    Select: (index: number | string, list: any[]) => { 'Fn::Select': [number | string, any[]] }
    Split: (delimiter: string, source: string) => { 'Fn::Split': [string, string] }
    GetAZs: (region?: string) => { 'Fn::GetAZs': string }
    ImportValue: (name: string) => { 'Fn::ImportValue': string }
    If: (condition: string, trueValue: any, falseValue: any) => { 'Fn::If': [string, any, any] }
    Equals: (value1: any, value2: any) => { 'Fn::Equals': [any, any] }
    And: (...conditions: any[]) => { 'Fn::And': any[] }
    Or: (...conditions: any[]) => { 'Fn::Or': any[] }
    Not: (condition: any) => { 'Fn::Not': [any] }
    Base64: (input: string) => { 'Fn::Base64': string }
  }

  export const Fn: IntrinsicFunctions
  export const Pseudo: {
    AccountId: { Ref: 'AWS::AccountId' }
    Region: { Ref: 'AWS::Region' }
    StackId: { Ref: 'AWS::StackId' }
    StackName: { Ref: 'AWS::StackName' }
    NotificationARNs: { Ref: 'AWS::NotificationARNs' }
    Partition: { Ref: 'AWS::Partition' }
    URLSuffix: { Ref: 'AWS::URLSuffix' }
    NoValue: { Ref: 'AWS::NoValue' }
  }

  export * from 'ts-cloud-types'
}
