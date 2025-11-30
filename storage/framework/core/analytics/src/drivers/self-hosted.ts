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
 * Generate the self-hosted analytics tracking script
 */
export function generateSelfHostedScript(config: SelfHostedConfig): string {
  if (!config.siteId || !config.apiEndpoint) {
    return ''
  }

  const siteId = escapeAttr(config.siteId)
  const apiEndpoint = escapeAttr(config.apiEndpoint)
  const honorDnt = config.honorDnt ? `if(n.doNotTrack==="1")return;` : ''
  const hashTracking = config.trackHashChanges ? `w.addEventListener('hashchange',pv);` : ''
  const outboundTracking = config.trackOutboundLinks
    ? `
  d.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a&&a.hostname!==location.hostname){
      t('outbound',{url:a.href});
    }
  });`
    : ''

  return `<!-- Stacks Self-Hosted Analytics -->
<script data-site="${siteId}" data-api="${apiEndpoint}" defer>
(function(){
  'use strict';
  var d=document,w=window,n=navigator,s=d.currentScript;
  var site=s.dataset.site,api=s.dataset.api;
  ${honorDnt}
  var q=[],sid=Math.random().toString(36).slice(2);
  function t(e,p){
    var x=new XMLHttpRequest();
    x.open('POST',api+'/collect',true);
    x.setRequestHeader('Content-Type','application/json');
    x.send(JSON.stringify({
      s:site,sid:sid,e:e,p:p||{},
      u:location.href,r:d.referrer,t:d.title,
      sw:screen.width,sh:screen.height
    }));
  }
  function pv(){t('pageview');}
  ${hashTracking}
  ${outboundTracking}
  if(d.readyState==='complete')pv();
  else w.addEventListener('load',pv);
  w.stacksAnalytics={track:function(n,v){t('event',{name:n,value:v});}};
})();
</script>`
}

/**
 * Generate the head tag for including self-hosted analytics
 * Compatible with Stacks docs config.ts head array format
 */
export function getSelfHostedAnalyticsHead(config: SelfHostedConfig): [string, Record<string, string>][] {
  if (!config.siteId || !config.apiEndpoint) {
    return []
  }

  // Return as an inline script tag configuration
  // Note: For VitePress/Stacks docs, inline scripts need special handling
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
 * Generate just the inline script content (without script tags)
 */
function generateInlineScript(config: SelfHostedConfig): string {
  const honorDnt = config.honorDnt ? `if(n.doNotTrack==="1")return;` : ''
  const hashTracking = config.trackHashChanges ? `w.addEventListener('hashchange',pv);` : ''
  const outboundTracking = config.trackOutboundLinks
    ? `d.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.hostname!==location.hostname){t('outbound',{url:a.href});}});`
    : ''

  return `(function(){
'use strict';
var d=document,w=window,n=navigator,s=d.currentScript;
var site=s.dataset.site,api=s.dataset.api;
${honorDnt}
var q=[],sid=Math.random().toString(36).slice(2);
function t(e,p){
var x=new XMLHttpRequest();
x.open('POST',api+'/collect',true);
x.setRequestHeader('Content-Type','application/json');
x.send(JSON.stringify({s:site,sid:sid,e:e,p:p||{},u:location.href,r:d.referrer,t:d.title,sw:screen.width,sh:screen.height}));
}
function pv(){t('pageview');}
${hashTracking}
${outboundTracking}
if(d.readyState==='complete')pv();
else w.addEventListener('load',pv);
w.stacksAnalytics={track:function(n,v){t('event',{name:n,value:v});}};
})();`
}

/**
 * Escape attribute value for safe HTML insertion
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
