/**
 * Run performance benchmarks
 */
export declare function runBenchmark(options?: BenchmarkOptions): Promise<void>;
export declare interface BenchmarkOptions {
  operations?: string
  iterations?: number
}
