// Stacks port: updates are reviewed and published with @stacksjs/defaults.
// A render or finalize command must never make an update/network request.
export function startDeliveryUpdateCheck() {
  return Promise.resolve({ status: 'unavailable', installedVersion: null,
    availableVersion: null, releaseNotes: null, checkedAt: null, source: null,
    noticeRequired: false, noticeText: null, reason: 'stacks-pinned-port' });
}
