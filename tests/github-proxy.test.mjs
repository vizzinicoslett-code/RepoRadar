import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProxyUrl, redactProxyUrl, parseWindowsProxy, readWindowsProxy, resolveProxySettings, bypassesProxy, createGitHubClient } from '../scripts/github-http-client.mjs'

const cannotRead = async () => { throw new Error('Registry must not be read') }
const quiet = () => {}

test('HTTPS_PROXY precedes all other environment proxy keys', async () => {
  const settings = await resolveProxySettings({ env: { HTTPS_PROXY: 'primary:8101', https_proxy: 'lower:8102', HTTP_PROXY: 'http:8103', http_proxy: 'last:8104' }, platform: 'win32', readSystemProxy: cannotRead })
  assert.equal(settings.proxyUrl, 'http://primary:8101')
  assert.equal(settings.source, 'HTTPS_PROXY')
})

test('lowercase HTTPS and uppercase/lowercase HTTP follow the specified order', async () => {
  for (const [env, expected, source] of [
    [{ https_proxy: 'secure:8201', HTTP_PROXY: 'plain:8202' }, 'http://secure:8201', 'https_proxy'],
    [{ HTTP_PROXY: 'plain:8202', http_proxy: 'lower:8203' }, 'http://plain:8202', 'HTTP_PROXY'],
    [{ http_proxy: 'lower:8203' }, 'http://lower:8203', 'http_proxy'],
  ]) {
    const settings = await resolveProxySettings({ env, platform: 'win32', readSystemProxy: cannotRead })
    assert.equal(settings.proxyUrl, expected)
    assert.equal(settings.source, source)
  }
})

test('Windows simple proxy is discovered without hardcoding a port', async () => {
  let reads = 0
  const settings = await resolveProxySettings({ env: {}, platform: 'win32', readSystemProxy: async () => { reads++; return { ProxyEnable: 1, ProxyServer: '127.0.0.1:9123' } } })
  assert.equal(settings.proxyUrl, 'http://127.0.0.1:9123')
  assert.equal(settings.source, 'windows')
  assert.equal(reads, 1)
})

test('Windows protocol map prefers HTTPS and falls back to HTTP', () => {
  assert.equal(parseWindowsProxy({ ProxyEnable: 1, ProxyServer: 'http=plain:8301;https=secure:8302' }), 'http://secure:8302')
  assert.equal(parseWindowsProxy({ ProxyEnable: 1, ProxyServer: 'https=https://secure:8302;http=plain:8301' }), 'https://secure:8302')
  assert.equal(parseWindowsProxy({ ProxyEnable: 1, ProxyServer: 'ftp=other:8300; HTTP = plain:8301' }), 'http://plain:8301')
  assert.equal(parseWindowsProxy({ ProxyEnable: 1, ProxyServer: 'socks=other:8300' }), null)
})

test('disabled Windows proxy is direct even with a saved server address', async () => {
  const settings = await resolveProxySettings({ env: {}, platform: 'win32', readSystemProxy: async () => ({ ProxyEnable: 0, ProxyServer: '127.0.0.1:8401' }) })
  assert.equal(settings.proxyUrl, null)
  assert.equal(settings.source, 'direct')
})

test('missing proxy settings and non-Windows environments stay direct', async () => {
  assert.equal((await resolveProxySettings({ env: {}, platform: 'linux', readSystemProxy: cannotRead })).proxyUrl, null)
  assert.equal((await resolveProxySettings({ env: {}, platform: 'win32', readSystemProxy: async () => null })).proxyUrl, null)
  assert.equal(parseWindowsProxy({ ProxyEnable: 1, ProxyServer: '' }), null)
})

test('GitHub Actions and CI skip the Windows registry without explicit proxies', async () => {
  for (const env of [{ GITHUB_ACTIONS: 'true' }, { CI: 'true' }, { CI: '1' }]) {
    const settings = await resolveProxySettings({ env, platform: 'win32', readSystemProxy: cannotRead })
    assert.equal(settings.proxyUrl, null)
  }
  const explicit = await resolveProxySettings({ env: { GITHUB_ACTIONS: 'true', HTTPS_PROXY: 'ci-proxy:8501' }, platform: 'win32', readSystemProxy: cannotRead })
  assert.equal(explicit.proxyUrl, 'http://ci-proxy:8501')
})

test('normalization adds a scheme and keeps HTTP or HTTPS transport', () => {
  assert.equal(normalizeProxyUrl(' 127.0.0.1:8601 '), 'http://127.0.0.1:8601')
  assert.equal(normalizeProxyUrl('http://proxy.example:8602'), 'http://proxy.example:8602')
  assert.equal(normalizeProxyUrl('https://proxy.example:8603/'), 'https://proxy.example:8603')
  assert.equal(normalizeProxyUrl('[::1]:8604'), 'http://[::1]:8604')
  for (const invalid of ['', 'http://', 'socks5://proxy.example:8601', 'http://proxy.example:99999', 'http://proxy.example/path', 'http://proxy.example?secret=private']) assert.throws(() => normalizeProxyUrl(invalid), /Invalid proxy URL/)
})

test('an invalid explicit environment proxy fails without consulting the registry or leaking credentials', async () => {
  await assert.rejects(resolveProxySettings({ env: { HTTPS_PROXY: 'socks5://fixture-user:fixture-password@proxy.example:8601' }, platform: 'win32', readSystemProxy: cannotRead }), (error) => {
    assert.ok(!error.message.includes('fixture-user') && !error.message.includes('fixture-password'))
    return true
  })
})

test('registry reader uses a fixed hidden PowerShell command and can be mocked', async () => {
  let calls = 0
  const result = await readWindowsProxy({ execute: async (program, args, options) => {
    calls++
    assert.equal(program, 'powershell.exe')
    assert.ok(args.includes('-NoProfile') && args.includes('-NonInteractive'))
    assert.ok(args.at(-1).includes("Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'"))
    assert.equal(options.windowsHide, true)
    assert.equal(options.timeout, 3000)
    return { stdout: '\uFEFF' + JSON.stringify({ ProxyEnable: 1, ProxyServer: 'registry-proxy:8701' }) }
  } })
  assert.deepEqual(result, { ProxyEnable: 1, ProxyServer: 'registry-proxy:8701' })
  assert.equal(calls, 1)
  assert.equal(await readWindowsProxy({ execute: async () => { throw new Error('registry unavailable') } }), null)
  assert.equal(await readWindowsProxy({ execute: async () => ({ stdout: '{bad JSON' }) }), null)
})

test('NO_PROXY and no_proxy are honored and loopback always bypasses', async () => {
  for (const key of ['NO_PROXY', 'no_proxy']) {
    const settings = await resolveProxySettings({ env: { HTTPS_PROXY: 'proxy.example:8801', [key]: 'api.github.com,.internal.example,other.example:8443' }, platform: 'linux', readSystemProxy: cannotRead })
    for (const url of ['https://api.github.com', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'https://a.internal.example', 'https://other.example:8443']) assert.equal(bypassesProxy(url, settings.noProxy), true)
    assert.equal(bypassesProxy('https://other.example', settings.noProxy), false)
    assert.equal(bypassesProxy('https://github.com', settings.noProxy), false)
  }
  assert.equal(bypassesProxy('https://api.github.com', '*'), true)
})

test('transport logs once, masks both credentials and routes NO_PROXY diagnostics correctly', async () => {
  const logs = []
  const client = await createGitHubClient({ env: { HTTPS_PROXY: 'http://fixture-user:fixture-password@proxy.example:8901' }, platform: 'linux', log: (line) => logs.push(line), fetcher: async () => new Response('{}') })
  assert.equal(redactProxyUrl('http://fixture-user:fixture-password@proxy.example:8901'), 'http://***:***@proxy.example:8901')
  await client.request('https://api.github.com/search/repositories', {}, 'one')
  await client.request('https://api.github.com/repos/radar/demo', {}, 'two')
  assert.deepEqual(logs, ['GitHub transport: proxy http://***:***@proxy.example:8901'])
  assert.equal(client.describe('http://localhost:3000'), 'direct')
  assert.ok(!JSON.stringify(logs).includes('fixture-password') && !JSON.stringify(logs).includes('fixture-user'))
  await client.close()
})

test('built-in proxy configuration is preferred and restored without changing process.env', async () => {
  let configured, restored = 0
  const originalEnvironment = { ...process.env }
  const client = await createGitHubClient({ env: { HTTPS_PROXY: 'native:9001', NO_PROXY: 'api.github.com' }, platform: 'linux', log: quiet,
    configureNative: (settings) => { configured = settings; return () => { restored++ } },
    loadUndici: async () => { throw new Error('Built-in capability must be preferred') },
  })
  assert.equal(configured.http_proxy, 'http://native:9001')
  assert.equal(configured.https_proxy, 'http://native:9001')
  assert.ok(configured.no_proxy.includes('localhost') && configured.no_proxy.includes('127.0.0.1'))
  assert.equal(client.describe('https://api.github.com'), 'direct')
  await client.close()
  assert.equal(restored, 1)
  assert.deepEqual({ ...process.env }, originalEnvironment)
})

test('older Node fallback uses one scoped Undici dispatcher for every request and closes it', async () => {
  const dispatchers = []
  let calls = 0, closed = false
  const client = await createGitHubClient({ env: { HTTP_PROXY: 'fallback:9101' }, platform: 'linux', log: quiet, configureNative: null,
    loadUndici: async () => ({
      EnvHttpProxyAgent: class { constructor(options) { this.options = options } async close() { closed = true } },
      fetch: async (_url, options) => {
        calls++
        dispatchers.push(options.dispatcher)
        assert.equal(options.redirect, 'error')
        assert.ok(options.signal instanceof AbortSignal)
        return new Response('{}')
      },
    }),
  })
  await client.request('https://api.github.com/search/repositories')
  await client.request('https://api.github.com/repos/radar/demo')
  assert.equal(calls, 2)
  assert.equal(dispatchers[0], dispatchers[1])
  assert.equal(dispatchers[0].options.httpsProxy, 'http://fallback:9101')
  assert.ok(dispatchers[0].options.noProxy.includes('localhost'))
  await client.close()
  assert.equal(closed, true)
})

for (const [code, category] of [['UND_ERR_CONNECT_TIMEOUT', 'timeout'], ['ECONNREFUSED', 'connection error'], ['ENOTFOUND', 'connection error']]) test(code + ' has query/transport/cause diagnostics without raw secrets', async () => {
  const client = await createGitHubClient({ env: { HTTPS_PROXY: 'fixture-user:fixture-password@proxy.example:9201' }, platform: 'linux', log: quiet,
    fetcher: async () => { throw new TypeError('raw message with fixture-secret', { cause: Object.assign(new Error('raw proxy fixture-password'), { code }) }) },
  })
  await assert.rejects(client.request('https://api.github.com/search/repositories', {}, 'recent-created'), (error) => {
    assert.ok(error.message.includes('recent-created') && error.message.includes('proxy http://***:***@proxy.example:9201'))
    assert.ok(error.message.includes(category) && error.message.includes(code))
    for (const secret of ['fixture-user', 'fixture-password', 'fixture-secret']) assert.ok(!error.message.includes(secret))
    return true
  })
  await client.close()
})

test('direct failures and malformed JSON have distinct safe diagnostics', async () => {
  const failed = await createGitHubClient({ env: {}, platform: 'linux', log: quiet, fetcher: async () => { throw new Error('private text') } })
  await assert.rejects(failed.request('https://api.github.com', {}, 'direct-query'), /direct-query, direct.*connection error, NETWORK_ERROR/)
  await failed.close()
  const client = await createGitHubClient({ env: {}, platform: 'linux', log: quiet, fetcher: async () => new Response('{invalid') })
  const response = await client.request('https://api.github.com', {}, 'json-query')
  await assert.rejects(client.json(response, 'https://api.github.com', 'json-query'), /invalid JSON.*json-query, direct.*SyntaxError/)
  await client.close()
})

test('response-body transport errors are not misreported as malformed JSON', async () => {
  const client = await createGitHubClient({ env: { HTTPS_PROXY: 'body-proxy:9301' }, platform: 'linux', log: quiet, fetcher: async () => ({ json: async () => { throw Object.assign(new Error('body failed'), { code: 'UND_ERR_SOCKET' }) } }) })
  const response = await client.request('https://api.github.com', {}, 'body-query')
  await assert.rejects(client.json(response, 'https://api.github.com', 'body-query'), /body-query, proxy http:\/\/body-proxy:9301.*connection error, UND_ERR_SOCKET/)
  await client.close()
})
