// ts-cloud stub - Cloud provider utilities
export interface CloudConfig { provider: string; region: string }
export function configure(config: CloudConfig): void {}
export default { configure }
