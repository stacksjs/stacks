type PipeFunction<T> = (data: T, next: (data: T) => T) => T

interface PipeClass<T> {
  handle: PipeFunction<T>
}

type Pipe<T> = PipeFunction<T> | PipeClass<T>

export class Pipeline<T> {
  private passable!: T
  private pipes: Pipe<T>[] = []
  private method = 'handle'

  static send<T>(passable: T): Pipeline<T> {
    const pipeline = new Pipeline<T>()
    pipeline.passable = passable
    return pipeline
  }

  through(pipes: Pipe<T>[]): this {
    this.pipes = pipes
    return this
  }

  pipe(...pipes: Pipe<T>[]): this {
    this.pipes.push(...pipes)
    return this
  }

  via(method: string): this {
    this.method = method
    return this
  }

  then(destination: (data: T) => T): T {
    const pipeline = this.pipes.reduceRight(
      (next: (data: T) => T, pipe: Pipe<T>) => {
        return (passable: T) => {
          if (typeof pipe === 'function') {
            return pipe(passable, next)
          }

          const handler = (pipe as any)[this.method]
          if (typeof handler === 'function') {
            return handler.call(pipe, passable, next)
          }

          return next(passable)
        }
      },
      destination,
    )

    return pipeline(this.passable)
  }

  thenReturn(): T {
    return this.then(passable => passable)
  }
}
