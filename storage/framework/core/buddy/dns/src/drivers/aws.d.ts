import type { CommandError, DeployOptions, Subprocess } from '@stacksjs/types';
import type { CreateHostedZoneResult, HostedZone } from '@stacksjs/ts-cloud/aws';
import type { Result } from '@stacksjs/error-handling';
export declare function deleteHostedZone(domainName: string): Promise<Result<string, Error>>;
// sometimes it's useful to delete all records but keep the hosted zone
// for example, if you want to keep the nameservers
export declare function deleteHostedZoneRecords(domainName: string): Promise<Result<string, Error>>;
export declare function createHostedZone(domainName: string): Promise<Result<HostedZone | CreateHostedZoneResult | string | null, Error>>;
export declare function writeNameserversToConfig(nameservers: string[]): void;
export declare function findHostedZone(domain: string): Promise<Result<string | null | undefined, Error>>;
/**
 * Get nameservers from Route53 Domains (for domains registered via Route53)
 */
export declare function getNameservers(domainName?: string): Promise<string[] | undefined>;
/**
 * Get nameservers from the Route53 hosted zone's delegation set
 * This works for any hosted zone, regardless of where the domain is registered
 */
export declare function getHostedZoneNameservers(domainName: string): Promise<string[]>;
/**
 * Update nameservers for a domain registered via Route53 Domains
 * If the domain is not registered via Route53 (external domain), this will skip the update
 * and just write the hosted zone nameservers to config
 */
export declare function updateNameservers(hostedZoneNameservers: string[], domainName?: string): Promise<boolean | undefined>;
// please note, this function also updates the user's nameservers if they are out of date
export declare function hasUserDomainBeenAddedToCloud(domainName?: string): Promise<boolean>;
export declare function addDomain(options: DeployOptions): Promise<Result<Subprocess, CommandError>>;
