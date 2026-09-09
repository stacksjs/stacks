/**
 * Self-Hosted Analytics Driver
 *
 * This driver generates a minimal, privacy-focused tracking script
 * that sends analytics data to your own API endpoint (powered by dynamodb-tooling analytics).
 *
 * Features:
 * - No cookies required
 * - Privacy-focused (hashed visitor IDs)
 * - Do Not Track support
 * - Page view tracking
 * - Custom event tracking
 * - Outbound link tracking (optional)
 * - Hash-based routing support (optional)
 */

import type { AnalyticsHeadTag } from './shared'
import { renderHeadTags } from './shared'

export interface SelfHostedConfig {
  /** Site ID for tracking */
  siteId: string
  /** API endpoint URL for collecting analytics */
  apiEndpoint: string
  /** Honor Do Not Track browser setting */
  honorDnt?: boolean
  /** Track hash changes as page views */
  trackHashChanges?: boolean
  /** Track outbound link clicks */
  trackOutboundLinks?: boolean
}

/**
 * Build the self-hosted head tags.
 *
 * Compatible with the Stacks/BunPress docs `head` array format. Values are raw;
 * escaping happens when the tags are rendered.
 */
export function getSelfHostedAnalyticsHead(config: SelfHostedConfig): AnalyticsHeadTag[] {
  if (!config.siteId || !config.apiEndpoint)
    return []

  return [
    ['script', {
      'data-site': config.siteId,
      'data-api': config.apiEndpoint,
      'defer': '',
      'innerHTML': generateInlineScript(config),
    }],
  ]
}

/**
 * Generate the self-hosted analytics tracking script
 */
export function generateSelfHostedScript(config: SelfHostedConfig): string {
  const tags = getSelfHostedAnalyticsHead(config)

  if (!tags.length)
    return ''

  return `<!-- Stacks Self-Hosted Analytics -->\n${renderHeadTags(tags)}`
}

/**
 * Generate just the inline script content (without script tags)
 */
function generateInlineScript(config: SelfHostedConfig): string {
  const honorDnt = config.honorDnt ? `if(n.doNotTrack==="1")return;` : ''
  const hashTracking = config.trackHashChanges ? `w.addEventListener('hashchange',pv);` : ''
  const outboundTracking = config.trackOutboundLinks
    ? `d.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.hostname!==location.hostname){t('outbound',{url:a.href});}});`
    : ''

  // `safeUrl` / `safeRef` below strip the query string before sending:
  // location.href carries tokens / session IDs / search terms that should not
  // reach the analytics backend, and the same goes for document.referrer when
  // it points back at our own domain (path is fine, query is not). The note
  // lives out here rather than inside the emitted script so a consumer that
  // collapses the inline body onto one line cannot comment out the tracker.
  return `(function(){
'use strict';
var d=document,w=window,n=navigator,s=d.currentScript;
var site=s.dataset.site,api=s.dataset.api;
${honorDnt}
var sid=Math.random().toString(36).slice(2);
function t(e,p){
var x=new XMLHttpRequest();
x.open('POST',api+'/collect',true);
x.setRequestHeader('Content-Type','application/json');
var safeUrl=location.origin+location.pathname+location.hash;
var safeRef=d.referrer?d.referrer.split('?')[0]:'';
x.send(JSON.stringify({s:site,sid:sid,e:e,p:p||{},u:safeUrl,r:safeRef,t:d.title,sw:screen.width,sh:screen.height}));
}
function pv(){t('pageview');}
${hashTracking}
${outboundTracking}
if(d.readyState==='complete')pv();
else w.addEventListener('load',pv);
w.stacksAnalytics={track:function(n,v){t('event',{name:n,value:v});}};
})();`
}
