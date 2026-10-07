import * as http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const executeFile = promisify(execFile)
const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']
const REGISTRY_COMMAND = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $settings = Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction Stop; [pscustomobject]@{ ProxyEnable = $settings.ProxyEnable; ProxyServer = $settings.ProxyServer } | ConvertTo-Json -Compress`

export function normalizeProxyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid proxy URL: expected an HTTP(S) address')
  const text = value.trim()
  let url
  try { url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `http://${text}`) }
  catch { throw new Error('Invalid proxy URL: expected an HTTP(S) address') }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid proxy URL: expected an HTTP(S) address without path/query')
  return url.href.replace(/\/$/, '')
}

export function redactProxyUrl(value) {
  const url = new URL(normalizeProxyUrl(value))
  // Hide both username and password; do not echo malformed values in errors.
  return `${url.protocol}//${url.username || url.password ? '***:***@' : ''}${url.host}`
}

export function parseWindowsProxy(settings) {
  if (Number(settings?.ProxyEnable) !== 1 || typeof settings.ProxyServer !== 'string' || !settings.ProxyServer.trim()) return null
  const server = settings.ProxyServer.trim()
  if (/^[a-z][a-z\d+.-]*\s*=/i.test(server)) {
    const entries = new Map(server.split(';').map((entry) => {
      const index = entry.indexOf('=')
      return [entry.slice(0, index).trim().toLowerCase(), entry.slice(index + 1).trim()]
    }))
    const address = entries.get('https') || entries.get('http')
    return address ? normalizeProxyUrl(address) : null
  }
  return normalizeProxyUrl(server)
}

export async function readWindowsProxy({ execute = executeFile } = {}) {
  try {
    // Fixed command and argument array: no shell interpolation or user-supplied code.
    const { stdout } = await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', REGISTRY_COMMAND], { windowsHide: true, timeout: 3000, maxBuffer: 16384, encoding: 'utf8' })
    const settings = JSON.parse(stdout.replace(/^\uFEFF/, '').trim())
    return { ProxyEnable: settings.ProxyEnable, ProxyServer: settings.ProxyServer }
  } catch { return null } // Unavailable registry is equivalent to no system proxy.
}

const ciFlag = (value) => Boolean(value) && !['false', '0'].includes(String(value).toLowerCase())
export async function resolveProxySettings({ env = process.env, platform = process.platform, readSystemProxy = readWindowsProxy } = {}) {
  let proxyUrl = null, source = 'direct'
  for (const key of PROXY_KEYS) {
    if (typeof env[key] === 'string' && env[key].trim()) { proxyUrl = normalizeProxyUrl(env[key]); source = key; break }
  }
  if (proxyUrl === null && platform === 'win32' && !ciFlag(env.GITHUB_ACTIONS) && !ciFlag(env.CI)) {
    proxyUrl = parseWindowsProxy(await readSystemProxy())
    if (proxyUrl) source = 'windows'
  }
  const noProxy = [env.NO_PROXY ?? env.no_proxy ?? '', 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(',')
  return { proxyUrl, source, noProxy }
}

export function bypassesProxy(input, noProxy) {
  const url = new URL(input)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return true
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  return noProxy.split(/[\s,]+/).filter(Boolean).some((entry) => {
    if (entry === '*') return true
    let pattern = entry.toLowerCase(), requiredPort = null
    const portMatch = pattern.match(/^([^:]+):(\d+)$/)
    if (portMatch) { pattern = portMatch[1]; requiredPort = portMatch[2] }
    if (requiredPort && requiredPort !== port) return false
    if (pattern.startsWith('*.')) pattern = pattern.slice(1)
    pattern = pattern.replace(/\.$/, '')
    return pattern.startsWith('.') ? host === pattern.slice(1) || host.endsWith(pattern) : host === pattern
  })
}

function safeFailureCause(error) {
  let current = error
  for (let depth = 0; current && depth < 6; depth++, current = current.cause) {
    if (typeof current.code === 'string' && /^(?:UND_ERR_[A-Z_]+|ERR_[A-Z_]+|E[A-Z]+)$/.test(current.code)) return current.code
  }
  return ['TimeoutError', 'AbortError', 'TypeError', 'SyntaxError'].includes(error?.name) ? error.name : 'NETWORK_ERROR'
}

export async function createGitHubClient({ env = process.env, platform = process.platform, readSystemProxy = readWindowsProxy, log = console.log, timeoutMs = 20000, fetcher, configureNative = http.setGlobalProxyFromEnv, loadUndici = () => import('undici') } = {}) {
  const settings = await resolveProxySettings({ env, platform, readSystemProxy })
  const proxyEnv = { http_proxy: settings.proxyUrl ?? '', https_proxy: settings.proxyUrl ?? '', no_proxy: settings.noProxy }
  let send = fetcher, restore = () => {}, dispatcher
  if (!send) {
    if (typeof configureNative === 'function') {
      // Configure once before the batch, restore after all response bodies are consumed.
      restore = configureNative(proxyEnv)
      send = globalThis.fetch
    } else {
      // Older supported Node releases lack the built-in runtime configuration API.
      const { EnvHttpProxyAgent, fetch } = await loadUndici()
      dispatcher = new EnvHttpProxyAgent({ httpProxy: settings.proxyUrl ?? '', httpsProxy: settings.proxyUrl ?? '', noProxy: settings.noProxy })
      send = fetch
    }
  }
  const describe = (url) => settings.proxyUrl && !bypassesProxy(url, settings.noProxy) ? 'proxy ' + redactProxyUrl(settings.proxyUrl) : 'direct'
  const requestSignals = new WeakMap()
  const failure = (error, url, queryName, signal) => {
    const cause = safeFailureCause(error)
    const kind = signal?.reason?.name === 'TimeoutError' || /TIMEOUT/i.test(cause) ? 'timeout' : signal?.aborted ? 'cancelled' : 'connection error'
    return new Error(`GitHub request failed (${queryName}, ${describe(url)}): ${kind}, ${cause}; previous JSON remains unchanged.`)
  }
  log('GitHub transport: ' + describe('https://api.github.com'))
  return {
    settings,
    describe,
    async request(url, options = {}, queryName = 'GitHub API') {
      const timeout = AbortSignal.timeout(timeoutMs)
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
      try {
        const response = await send(url, { ...options, signal, redirect: 'error', ...(dispatcher ? { dispatcher } : {}) })
        requestSignals.set(response, signal)
        return response
      }
      catch (error) {
        // Never print raw error messages, URLs with credentials, headers, or tokens.
        throw failure(error, url, queryName, signal)
      }
    },
    async json(response, url, queryName = 'GitHub API') {
      try { return await response.json() }
      catch (error) {
        if (error?.name === 'SyntaxError') throw new Error(`GitHub returned invalid JSON (${queryName}, ${describe(url)}): SyntaxError; previous JSON remains unchanged.`)
        throw failure(error, url, queryName, requestSignals.get(response))
      }
    },
    async close() { try { if (dispatcher) await dispatcher.close() } finally { restore() } },
  }
}
