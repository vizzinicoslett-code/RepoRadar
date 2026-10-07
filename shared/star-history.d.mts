import type { GitHubRepoData, DerivedMetrics, GrowthDetail, StarHistory, Snapshot } from '../src/types/repo.ts'
export const WINDOWS: Record<'day' | 'week' | 'month', [number, number]>
export const WEIGHTS: Record<string, number>
export function emptyHistory(now: string): StarHistory
export function validateHistory(value: unknown): StarHistory
export function captureSnapshots(history: StarHistory, repositories: GitHubRepoData[], now: string): StarHistory
export function calculateGrowth(stars: number | null, snapshots: Snapshot[], now: string, period: 'day' | 'week' | 'month'): GrowthDetail | null
export function percentile(value: number, pool: number[]): number
export function deriveMetrics(repositories: GitHubRepoData[], history: StarHistory, now: string): Record<string, DerivedMetrics>
export function validateMetrics(value: unknown, repositories: GitHubRepoData[], now: string): Record<string, DerivedMetrics>
