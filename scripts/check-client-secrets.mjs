import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const patterns = [
  { label: 'classic credential', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { label: 'fine-grained credential', pattern: /github_pat_[A-Za-z0-9_]{30,}/ },
]
const matches = []
let scanned = 0
async function check(path, browserFile) {
  const content = await readFile(join(root, path), 'utf8')
  scanned++
  for (const { label, pattern } of patterns) if (pattern.test(content)) matches.push({ path, label })
  if (browserFile && /GITHUB_TOKEN|Authorization\s*:/.test(content)) matches.push({ path, label: 'server authentication reference in client files' })
  if (process.env.GITHUB_TOKEN && content.includes(process.env.GITHUB_TOKEN)) matches.push({ path, label: 'environment credential value' })
}
async function walk(path) {
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) await walk(child)
    else await check(child, true)
  }
}
try {
  for (const directory of ['src', 'public', 'dist']) await walk(directory)
  await check('README.md', false)
  if (matches.length) {
    console.error('Client credential check failed (values redacted): ' + JSON.stringify(matches))
    process.exitCode = 1
  } else console.log('Client credential check passed: ' + scanned + ' files scanned, no credentials or client authentication headers.')
} catch {
  console.error('Client credential check could not complete. Run npm run build first.')
  process.exitCode = 1
}
