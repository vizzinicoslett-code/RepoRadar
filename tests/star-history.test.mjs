import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, writeFile, mkdtemp, readdir, rm, rmdir, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyHistory, validateHistory, captureSnapshots, calculateGrowth, deriveMetrics, percentile, validateMetrics } from '../shared/star-history.mjs'
import { validateGitHubDataset } from '../shared/github-data.mjs'
import { runPipeline, withDataLock } from '../scripts/data-pipeline.mjs'
const now = '2026-10-05T08:00:00.000Z'
const ago = (hours) => new Date(Date.parse(now) - hours * 3600000).toISOString()
const snapshot = (hours, stars) => ({ capturedAt: ago(hours), stars })
const repo = (githubId, stars, pushedAt = now) => ({ githubId, fullName: 'radar/repo-' + githubId, stars, pushedAt })
function historyFor(entries) { return { ...emptyHistory(now), repositories: Object.fromEntries(entries.map(([id, snapshots]) => [id, { fullName: 'radar/repo-' + id, snapshots: snapshots.sort((a,b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)) }])) } }

test('24h positive, negative, zero and missing growth preserve real deltas', () => {
  assert.equal(calculateGrowth(150, [snapshot(24, 100)], now, 'day').delta, 50)
  assert.equal(calculateGrowth(88, [snapshot(24, 100)], now, 'day').delta, -12)
  assert.equal(calculateGrowth(100, [snapshot(24, 100)], now, 'day').delta, 0)
  assert.equal(calculateGrowth(100, [snapshot(0, 100)], now, 'day'), null)
  assert.equal(calculateGrowth(null, [snapshot(24, 100)], now, 'day'), null)
})
for (const [period, hours, tolerance] of [['day',24,8],['week',168,18],['month',720,36]]) {
  test(period + ' tolerance includes boundary and rejects outside', () => {
    const inside = calculateGrowth(150, [snapshot(hours + tolerance, 100)], now, period)
    assert.equal(inside.delta, 50); assert.equal(inside.actualWindowHours, hours + tolerance)
    assert.equal(inside.baselineCapturedAt, ago(hours + tolerance))
    assert.equal(calculateGrowth(150, [snapshot(hours + tolerance + .001, 100)], now, period), null)
  })
}
test('nearest baseline wins, ties use the earlier observation, zero baseline has null rate', () => {
  assert.equal(calculateGrowth(50, [snapshot(25, 20), snapshot(23, 30)], now, 'day').baselineStars, 20)
  assert.equal(calculateGrowth(50, [snapshot(25, 20), snapshot(24.5, 30)], now, 'day').baselineStars, 30)
  const g = calculateGrowth(50, [snapshot(24, 0)], now, 'day')
  assert.equal(g.rate, null); assert.equal(g.delta, 50); assert.ok(!JSON.stringify(g).includes('Infinity'))
})
test('snapshot identity, near duplicate skip, exact 3h boundary and rename', () => {
  const old = historyFor([[1, [snapshot(2, 10)]]])
  const next = captureSnapshots(old, [repo(1, 12), repo(1, 999)], now)
  assert.equal(next.repositories[1].snapshots.length, 1)
  assert.equal(next.repositories[1].fullName, 'radar/repo-1')
  const later = captureSnapshots(next, [{ ...repo(1, 20), fullName: 'new-owner/renamed' }], new Date(Date.parse(now)+3600000).toISOString())
  assert.equal(later.repositories[1].snapshots.length, 2)
  assert.equal(later.repositories[1].fullName, 'new-owner/renamed')
})
test('35d rolling history prunes old data and keeps inactive repository history', () => {
  const old = historyFor([[1,[snapshot(841,1),snapshot(840,2),snapshot(24,3)]],[2,[snapshot(100,9)]],[3,[snapshot(841,7)]]])
  const next = captureSnapshots(old, [repo(1,4)], now)
  assert.deepEqual(next.repositories[1].snapshots.map((s)=>s.stars), [2,3,4])
  assert.equal(next.repositories[2].snapshots.length, 1)
  assert.equal(next.repositories[3], undefined)
  assert.equal(old.repositories[1].snapshots.length, 3)
})
test('history rejects invalid IDs, times, stars and duplicates', () => {
  assert.throws(()=>validateHistory({}))
  for(const snapshots of [[snapshot(1,-1)],[snapshot(1,1),snapshot(1,2)],[{capturedAt:'invalid',stars:1}],[snapshot(-1,1)]]) assert.throws(()=>validateHistory(historyFor([[1,snapshots]])))
  assert.throws(()=>captureSnapshots(emptyHistory(now), [repo(1,null)], now))
})
test('percentiles handle ties and zeros deterministically', () => {
  assert.equal(percentile(10,[10,10,20]), .25)
  assert.equal(percentile(0,[0,0,0]), 0)
  assert.equal(percentile(10,[10]), 1)
})
const pool = [repo(1,100010),repo(2,500),repo(3,101000),repo(4,99)]
const hotHistory = historyFor([[1,[snapshot(168,99960),snapshot(24,100000)]],[2,[snapshot(168,50),snapshot(24,100)]],[3,[snapshot(168,96000),snapshot(24,100000)]]])
test('fixture hot score favors growth, not total Stars; no day means null', () => {
  const m = deriveMetrics(pool, hotHistory, now)
  assert.equal(m[1].hotScore, 10); assert.equal(m[2].hotScore, 68); assert.equal(m[3].hotScore, 88)
  assert.equal(m[4].hotScore, null)
  assert.ok(m[2].hotScore > m[1].hotScore)
  assert.equal(m[2].growth.day.rate, 4)
})
test('only day metrics re-normalize weights, with missing week and activity', () => {
  const m = deriveMetrics([repo(1,150,null)], historyFor([[1,[snapshot(24,100)]]]), now)[1]
  assert.equal(m.hotScore,100); assert.equal(m.hotComponents.absolute7d,null); assert.equal(m.hotComponents.activity,null)
  const z = deriveMetrics([repo(1,50,null)],historyFor([[1,[snapshot(24,0)]]]),now)[1]
  assert.equal(z.hotScore,100); assert.equal(z.hotComponents.relative24h,null)
})
test('negative growth contributes zero; activity uses pushedAt and declines across 30d', () => {
  const m = deriveMetrics([repo(1,80,ago(360)),repo(2,80,ago(721)),repo(3,80,null)], historyFor([1,2,3].map((id)=>[id,[snapshot(24,100)]])),now)
  assert.equal(m[1].hotComponents.activity,.5); assert.equal(m[2].hotComponents.activity,0); assert.equal(m[3].hotComponents.activity,null)
  assert.equal(m[1].hotComponents.absolute24h,0); assert.equal(m[1].hotComponents.relative24h,0)
})
test('metrics validate observed growth, exact score and whitelist', () => {
  const metrics = deriveMetrics(pool,hotHistory,now)
  assert.deepEqual(validateMetrics(metrics,pool,now),metrics)
  const bad = structuredClone(metrics); bad[1].growth.day.delta = 1000
  assert.throws(()=>validateMetrics(bad,pool,now))
  const badScore = structuredClone(metrics); badScore[1].hotScore = 100
  assert.throws(()=>validateMetrics(badScore,pool,now))
})
async function withFiles(run) {
  const dir = await mkdtemp(join(tmpdir(),'reporadar-history-'))
  const outputPath = join(dir,'repos.json'), historyPath = join(dir,'star-history.json')
  const base = validateGitHubDataset(JSON.parse(await readFile(new URL('../public/data/repos.json',import.meta.url),'utf8')))
  delete base.metrics
  const old = JSON.stringify(base), oldHistory = JSON.stringify(emptyHistory(base.generatedAt))
  await writeFile(outputPath,old); await writeFile(historyPath,oldHistory)
  try { await run({outputPath,historyPath},old,oldHistory,dir,base) }
  finally { for(const entry of await readdir(dir)) await rm(join(dir,entry),{force:true}); await rmdir(dir) }
}
test('invalid history JSON never overwrites either data file', async()=> {
  await withFiles(async(options,old)=> {
    await writeFile(options.historyPath,'{broken')
    await assert.rejects(runPipeline('snapshot',options))
    assert.equal(await readFile(options.outputPath,'utf8'),old)
    assert.equal(await readFile(options.historyPath,'utf8'),'{broken')
  })
})
test('second replacement failure restores both previous files', async()=> {
  await withFiles(async(options,old,oldHistory,dir)=> {
    let calls=0
    await assert.rejects(runPipeline('snapshot',{...options,renamer:async(a,b)=>{if(++calls===2)throw Error('fixture disk failure');await rename(a,b)}}))
    assert.equal(await readFile(options.outputPath,'utf8'),old)
    assert.equal(await readFile(options.historyPath,'utf8'),oldHistory)
    assert.deepEqual((await readdir(dir)).sort(),['repos.json','star-history.json'])
  })
})
test('successful pipeline snapshots then derives, and repeat does not duplicate',async()=> {
  await withFiles(async(options)=> {
    const first = await runPipeline('snapshot',options)
    assert.ok(first.dataset.metrics)
    const second = await runPipeline('derive',options)
    assert.deepEqual(second,first)
    assert.deepEqual((await runPipeline('snapshot',options)).history,first.history)
  })
})
test('interrupted transaction journal restores the previous pair before operation', async()=> {
  await withFiles(async(options,old,oldHistory)=> {
    await writeFile(options.outputPath,'partial')
    await writeFile(options.outputPath+'.journal',JSON.stringify([old,oldHistory]))
    await withDataLock(options.outputPath,options.historyPath,async()=> {
      assert.equal(await readFile(options.outputPath,'utf8'),old)
      assert.equal(await readFile(options.historyPath,'utf8'),oldHistory)
    })
  })
})

test('refresh fetch failure leaves both previously valid files byte-for-byte unchanged',async()=> {
  await withFiles(async(options,old,oldHistory)=>{
    await assert.rejects(runPipeline('refresh',{...options,fetcher:async()=>new Response('{invalid'),log:()=>{},wait:async()=>{}}))
    assert.equal(await readFile(options.outputPath,'utf8'),old)
    assert.equal(await readFile(options.historyPath,'utf8'),oldHistory)
  })
})
