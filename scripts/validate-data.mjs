import { readFile } from 'node:fs/promises'
import { validateGitHubDataset } from '../shared/github-data.mjs'
import { validateHistory, deriveMetrics } from '../shared/star-history.mjs'

try {
  const data = validateGitHubDataset(JSON.parse(await readFile(new URL('../public/data/repos.json', import.meta.url), 'utf8')))
  const history = validateHistory(JSON.parse(await readFile(new URL('../public/data/star-history.json', import.meta.url), 'utf8')))
  if (data.repoCount < 50) throw new Error('Generated pool must contain at least 50 repositories')
  if (!data.metrics || JSON.stringify(data.metrics) !== JSON.stringify(deriveMetrics(data.repositories, history, data.generatedAt))) throw new Error('Run data:derive or data:refresh: dataset/history metrics mismatch')
  console.log('Valid GitHub dataset and Star history: ' + data.repoCount + ' repositories, generated ' + data.generatedAt)
} catch (error) {
  console.error('Invalid dataset: ' + (error instanceof Error ? error.message : 'Unknown failure'))
  process.exitCode = 1
}
