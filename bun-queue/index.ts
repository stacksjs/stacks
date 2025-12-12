// bun-queue stub - Queue management
export class Queue {
  constructor(public name: string) {}
  add(job: unknown): Promise<void> { return Promise.resolve() }
  process(handler: (job: unknown) => Promise<void>): void {}
}
export function createQueue(name: string): Queue {
  return new Queue(name)
}
export default { Queue, createQueue }
