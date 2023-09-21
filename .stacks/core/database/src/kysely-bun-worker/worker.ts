import Database from 'bun:sqlite'
import type { QueryResult } from 'kysely'
import type { MainMsg, RunMode, WorkerMsg } from './type'

let db: Database
let cache: boolean
function run(mode: RunMode, sql: string, parameters?: readonly unknown[]): QueryResult<any> {
  const stmt = db[cache ? 'query' : 'prepare'](sql)

  let rows: unknown[] = []
  if (mode !== 'exec')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    rows = stmt.all(parameters as any)

  if (mode === 'query')
    return { rows }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  stmt.run(parameters as any)
  return {
    rows,
    // @ts-expect-error get insert id
    insertId: db.query('SELECT last_insert_rowid() as i').get().i,
    // @ts-expect-error get changes
    numAffectedRows: db.query('SELECT changes() as c').get().c,
  }
}

// @ts-expect-error bun worker
onmessage = ({ data }: MessageEvent<MainMsg>) => {
  const ret: WorkerMsg = {
    type: data.type,
    data: null,
    err: null,
  }
  try {
    switch (data.type) {
      case 'run':
        ret.data = run(data.mode, data.sql, data.parameters)
        break
      case 'close':
        db.close()
        break
      case 'init':
        db = new Database(data.url, { create: true })
        cache = data.cache
        break
    }
  }
  catch (error) {
    ret.err = error
  }
  postMessage(ret)
}
