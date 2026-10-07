import assert from 'node:assert/strict'
import test from 'node:test'
import { TranslationService } from '../src/services/translation/translator.ts'
import { TranslationCache, CACHE_KEY, MODE_KEY, translationKey } from '../src/services/translation/translationCache.ts'
import { browserTranslator } from '../src/services/translation/chromeTranslator.ts'
import type { TranslatorAPI, Availability } from '../src/services/translation/chromeTranslator.ts'
function storage() {
  const values = new Map<string,string>()
  return { getItem: (key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{values.set(key,value)} }
}
function mockAPI(availability:Availability='downloadable') {
  let created=0,translated=0,active=0,maxActive=0
  const texts:string[]=[]
  const api:TranslatorAPI = {
    availability:async()=>availability,
    create:async(options)=> {
      created++; assert.equal(options.sourceLanguage,'en');assert.equal(options.targetLanguage,'zh')
      options.monitor?.({addEventListener:(_,listener)=>listener({loaded:.42})})
      return {translate:async(text)=>{translated++;texts.push(text);active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;if(text==='fail')throw Error('fixture failure');return '中文：'+text}}
    },
  }
  return {api,counts:()=>({created,translated,maxActive,texts})}
}
test('feature detection uses globalThis.Translator safely',()=> {
  const target=globalThis as typeof globalThis & {Translator?:TranslatorAPI}
  const previous=target.Translator
  try { delete target.Translator;assert.equal(browserTranslator(),null);target.Translator=mockAPI().api;assert.equal(browserTranslator(),target.Translator) }
  finally { if(previous)target.Translator=previous;else delete target.Translator }
})
test('unsupported API restores original, never creates and falls back to original',async()=> {
  const store=storage();store.setItem(MODE_KEY,'zh')
  const service=new TranslationService(null,store)
  assert.equal(service.getSnapshot().status,'unsupported');assert.equal(service.getSnapshot().mode,'original')
  await service.activateChinese();assert.equal(await service.translate('hello'),null)
  assert.equal(store.getItem(MODE_KEY),'original')
})
test('downloadable detection does not initialize model; explicit click creates synchronously and shows progress',async()=> {
  const mock=mockAPI();const service=new TranslationService(mock.api,storage())
  await service.checkAvailability();assert.equal(service.getSnapshot().status,'downloadable');assert.equal(mock.counts().created,0)
  const promise=service.activateChinese()
  assert.equal(mock.counts().created,1);assert.equal(service.getSnapshot().progress,42)
  await promise;assert.equal(service.getSnapshot().status,'ready');assert.equal(service.getSnapshot().mode,'zh')
})
test('unavailable language pair safely returns original',async()=> {
  const mock=mockAPI('unavailable');const service=new TranslationService(mock.api,storage())
  await service.checkAvailability();await service.activateChinese()
  assert.equal(service.getSnapshot().status,'unsupported');assert.equal(mock.counts().created,0)
})
test('restored Chinese mode reads cache but does not create or download',async()=> {
  const store=storage();store.setItem(MODE_KEY,'zh');const cache=new TranslationCache(store);cache.put('hello','你好')
  const mock=mockAPI();const service=new TranslationService(mock.api,store)
  await service.checkAvailability()
  assert.equal(service.getSnapshot().mode,'zh');assert.equal(service.cached('hello'),'你好')
  assert.equal(await service.translate('new text'),null);assert.equal(mock.counts().created,0)
})
test('cache hit/miss and changed descriptions use separate keys',async()=> {
  const mock=mockAPI(),store=storage(),service=new TranslationService(mock.api,store)
  await service.activateChinese()
  assert.equal(await service.translate('A tool'),'中文：A tool')
  assert.equal(await service.translate('A tool'),'中文：A tool')
  assert.equal(await service.translate('A better tool'),'中文：A better tool')
  assert.equal(mock.counts().translated,2)
  assert.notEqual(translationKey('A tool'),translationKey('A better tool'))
  const restored=new TranslationService(mock.api,store);assert.equal(restored.cached('A tool'),'中文：A tool')
})
test('single translation failure keeps original fallback and later tasks continue',async()=> {
  const mock=mockAPI(),service=new TranslationService(mock.api,storage())
  await service.activateChinese()
  assert.equal(await service.translate('fail'),null)
  assert.equal(await service.translate('good'),'中文：good')
  service.original();assert.equal(await service.translate('new'),null)
  assert.equal(service.getSnapshot().mode,'original')
})
test('creation failure shows error without losing original text and supports retry',async()=> {
  const mock=mockAPI();let failures=1
  const api:TranslatorAPI={...mock.api,create:(options)=>{if(failures-->0)return Promise.reject(Error('download failed'));return mock.api.create(options)}}
  const service=new TranslationService(api,storage())
  await service.activateChinese();assert.equal(service.getSnapshot().status,'error');assert.equal(await service.translate('hi'),null)
  await service.activateChinese();assert.equal(await service.translate('hi'),'中文：hi')
})
test('sequential queue deduplicates identical descriptions and skips invisible tasks',async()=> {
  const mock=mockAPI(),service=new TranslationService(mock.api,storage());await service.activateChinese()
  const one=service.translate('one');const same=service.translate('one')
  const hidden=service.translate('hidden',()=>false),two=service.translate('two')
  assert.equal(one,same)
  assert.deepEqual(await Promise.all([one,same,hidden,two]),['中文：one','中文：one',null,'中文：two'])
  assert.equal(mock.counts().maxActive,1);assert.equal(mock.counts().translated,2)
})
test('deduplicated task keeps visible consumers when first description unmounts',async()=> {
  const mock=mockAPI(),service=new TranslationService(mock.api,storage());await service.activateChinese()
  const one=service.translate('shared',()=>false);const two=service.translate('shared',()=>true)
  assert.equal(one,two);assert.equal(await two,'中文：shared')
})
test('cache LRU stays at 500, protects exact text, handles corrupt and unavailable storage',()=> {
  const store=storage();let now=0;const cache=new TranslationCache(store,()=>++now)
  for(let i=0;i<500;i++)cache.put('text'+i,'翻译'+i)
  cache.get('text0');cache.put('text500','翻译500')
  assert.equal(cache.get('text1'),null);assert.equal(cache.get('text0'),'翻译0')
  assert.equal(Object.keys(JSON.parse(store.getItem(CACHE_KEY)!)).length,500)
  store.setItem(CACHE_KEY,'{bad');assert.equal(new TranslationCache(store).get('hi'),null)
  store.setItem(CACHE_KEY,JSON.stringify({[translationKey('hi')]:{originalText:'other',translatedText:'wrong',createdAt:1,lastUsedAt:1}}))
  assert.equal(new TranslationCache(store).get('hi'),null)
  const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('quota')}}
  const memory=new TranslationCache(blocked);memory.put('hello','你好');assert.equal(memory.get('hello'),'你好')
})
