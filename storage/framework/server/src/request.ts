/**
 * WebSocket negotiation is rare compared with ordinary HTTP traffic. Calling
 * Bun's upgrade machinery for every request needlessly parses upgrade state on
 * the hottest server path, so gate it on the protocol header first.
 */
export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket'
}
