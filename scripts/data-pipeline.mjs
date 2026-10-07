import { mkdir, readFile, writeFile, rename, rm, open } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { collectRepositories, OUTPUT_PATH } from './fetch-github-repos.mjs'
import { validateGitHubDataset } from '../shared/github-data.mjs'
import { emptyHistory, validateHistory, captureSnapshots, deriveMetrics } from '../shared/star-history.mjs'

export const HISTORY_PATH = fileURLToPath(new URL('../public/data/star-history.json', import.meta.url))
async function optionalRead(path) {
  try { return await readFile(path, 'utf8') } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
async function replace(path, contents, renamer = rename) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
  try { await writeFile(temp, contents, { encoding: 'utf8', flag: 'wx' }); await renamer(temp, path) }
  finally { await rm(temp, { force: true }) }
}

// A journal makes an interrupted two-file replacement recoverable on the next run.
// A live-process lock prevents another local refresh from recovering an active write.
export async function withDataLock(repoPath, historyPath, operation) {
  await mkdir(dirname(repoPath), { recursive: true })
  const lockPath = `${repoPath}.lock`
  const journalPath = `${repoPath}.journal`
  let lock
  try { lock = await open(lockPath, 'wx') } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const pid = Number(await readFile(lockPath, 'utf8'))
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid data lock; inspect it before retrying')
    let alive = true
    try { process.kill(pid, 0) } catch (cause) { if (cause.code === 'ESRCH') alive = false; else throw cause }
    if (alive) throw new Error('Another data operation is running; previous files unchanged')
    await rm(lockPath)
    lock = await open(lockPath, 'wx')
  }
  try {
    await lock.writeFile(String(process.pid))
    const recover = async () => {
      const bytes = await optionalRead(journalPath)
      if (bytes === null) return
      const previous = JSON.parse(bytes)
      if (!Array.isArray(previous) || previous.length !== 2 || previous.some((x) => x !== null && typeof x !== 'string')) throw new Error('Invalid recovery journal')
      for (const [index, path] of [repoPath, historyPath].entries()) {
        if (previous[index] === null) await rm(path, { force: true })
        else await replace(path, previous[index])
      }
      await rm(journalPath)
    }
    await recover()
    return await operation(async (dataset, history, renamer = rename) => {
      const checked = validateGitHubDataset(dataset)
      const checkedHistory = validateHistory(history)
      if (checked.repoCount < 50) throw new Error('Minimum 50 repositories required')
      if (JSON.stringify(checked.metrics) !== JSON.stringify(deriveMetrics(checked.repositories, checkedHistory, checked.generatedAt))) throw new Error('Dataset/history mismatch')
      const previous = await Promise.all([optionalRead(repoPath), optionalRead(historyPath)])
      await writeFile(journalPath, JSON.stringify(previous), { encoding: 'utf8', flag: 'wx' })
      try {
        // All fetch/snapshot/derive/validation happens before replacing either file.
        await replace(repoPath, JSON.stringify(checked, null, 2) + '\n', renamer)
        await replace(historyPath, JSON.stringify(checkedHistory, null, 2) + '\n', renamer)
        await rm(journalPath)
      } catch (error) {
        try { await recover() } catch { throw new Error('Data replacement failed; recovery journal retained. Retry after resolving filesystem permissions.') }
        throw error
      }
    })
  } finally { await lock.close(); await rm(lockPath, { force: true }) }
}

export async function runPipeline(mode = 'refresh', options = {}) {
  const repoPath = options.outputPath ?? OUTPUT_PATH
  const historyPath = options.historyPath ?? HISTORY_PATH
  return withDataLock(repoPath, historyPath, async (commit) => {
    let dataset = mode === 'refresh' ? (await collectRepositories(options)).dataset : validateGitHubDataset(JSON.parse(await readFile(repoPath, 'utf8')))
    const historyBytes = await optionalRead(historyPath)
    let history = historyBytes === null ? emptyHistory(dataset.generatedAt) : validateHistory(JSON.parse(historyBytes))
    if (mode !== 'derive') history = captureSnapshots(history, dataset.repositories, dataset.generatedAt)
    dataset = validateGitHubDataset({ ...dataset, metrics: deriveMetrics(dataset.repositories, history, dataset.generatedAt) })
    await commit(dataset, history, options.renamer)
    return { dataset, history }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2] ?? 'refresh'
    if (!['refresh', 'snapshot', 'derive'].includes(mode)) throw new Error('Unknown data command')
    const { dataset, history } = await runPipeline(mode)
    const counts = Object.fromEntries(['day', 'week', 'month'].map((key) => [key, Object.values(dataset.metrics).filter((m) => m.growth[key] !== null).length]))
    console.log(`Updated ${dataset.repoCount} repositories; retained ${Object.keys(history.repositories).length} histories. Growth: ${JSON.stringify(counts)}`)
  } catch (error) { console.error(`Data pipeline stopped: ${error.message}`); process.exitCode = 1 }
}
