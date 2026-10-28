import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
import assert from 'node:assert/strict';
const base=process.env.PTK_SMOKE_URL||'http://127.0.0.1:21009';
const passed=[];
let cookie='';
async function api(url,body,method=body?'POST':'GET') {
 const r=await fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const txt=await r.text();let data;try{data=JSON.parse(txt);}catch{data=txt;}
 assert(r.ok,`${method} ${url}: ${r.status} ${JSON.stringify(data).slice(0,400)}`);return data;
}
const mockHits=[];
const mock=http.createServer(async(req,res)=>{
 let text='';for await(const c of req)text+=c;const b=JSON.parse(text||'{}');mockHits.push({model:b.model,url:req.url,stream:!!b.stream});
 if(b.model==='fail'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Synthetic unavailable',type:'server_error'}}));return;}
 const usage={prompt_tokens:9,completion_tokens:3,total_tokens:12};
 if(b.stream){
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  for(const chunk of [
   {choices:[{index:0,delta:{role:'assistant',content:'PTK fixture OK'},finish_reason:null}]},
   {choices:[{index:0,delta:{},finish_reason:'stop'}],usage}
  ])res.write('data: '+JSON.stringify({id:'chatcmpl-ptkfixture',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:b.model,...chunk})+'\n\n');
  res.end('data: [DONE]\n\n');
 }else{
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'chatcmpl-ptkfixture',object:'chat.completion',created:Math.floor(Date.now()/1000),model:b.model,choices:[{index:0,message:{role:'assistant',content:'PTK fixture OK'},finish_reason:'stop'}],usage}));
 }
});
try{
 const health=await api('/api/health');assert(health.ok);passed.push('health');
 const guard=await fetch(base+'/api/health',{headers:{Origin:'https://example.invalid'}});assert.equal(guard.status,403);passed.push('cross-origin blocked');
 const cloud=await fetch(base+'/api/tunnel/enable',{method:'POST'});assert.equal(cloud.status,410);passed.push('cloud actions disabled');
 const anon=await fetch(base+'/api/ptk/local');assert.equal(anon.status,401);passed.push('dashboard protected');
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'123456'})});
 assert(login.ok);cookie=login.headers.get('set-cookie')?.split(';')[0];assert(cookie);passed.push('fixture login');
 const initial=await api('/api/ptk/local');assert.equal(path.resolve(initial.dataDir),path.join(root,'data/smoke-isolated'));assert(fs.existsSync(path.join(initial.dataDir,'.ptk-smoke')),'Refuse non-fixture server');
 await api('/api/ptk/local',{action:'presets'});const state=await api('/api/ptk/local');
 for(const p of state.profiles)assert.deepEqual(p.key.access,{restricted:true,allow:[p.provider+'/*']});
 assert.equal(state.mitmKeyId,state.profiles.find(p=>p.app==='antigravity').key.id);
 const rerun=await api('/api/ptk/local',{action:'presets'});assert.equal(rerun.created.length,0);passed.push('managed profiles and idempotency');
 const preview=await api('/api/ptk/local',{action:'preview-import'});assert.equal(preview.connections.length,2);
 const imported=await api('/api/ptk/local',{action:'import',providers:['codex','antigravity']});assert(imported.imported+imported.skipped===2);
 const afterImport=await api('/api/ptk/local');for(const c of afterImport.connections.filter(c=>['codex','antigravity'].includes(c.provider)))assert.equal(c.isActive,false);
 for(const c of afterImport.connections.filter(c=>['codex','antigravity'].includes(c.provider))){const quota=await api('/api/usage/'+c.id);assert.equal(quota.paused,true);assert.deepEqual(quota.quotas,{});}
 passed.push('paused accounts do not query quota or refresh tokens');
 const duplicate=await api('/api/ptk/local',{action:'import',providers:['codex','antigravity']});assert.equal(duplicate.imported,0);assert.equal(duplicate.skipped,2);passed.push('credential import inactive and deduplicated');
 const saved=await api('/api/ptk/local',{action:'save-runtime',port:21009,mitmDns:'google-doh'});assert(saved.ok);assert.equal(JSON.parse(fs.readFileSync(state.runtime.configPath,'utf8')).mitmDns,'google-doh');passed.push('central launcher config saved');
 const keys=(await api('/api/keys')).keys;
 const codexHome=path.join(state.dataDir,'home/.codex');const authPath=path.join(codexHome,'auth.json');const originalAuth=fs.readFileSync(authPath,'utf8');const configPath=path.join(codexHome,'config.toml');const originalConfig=fs.readFileSync(configPath,'utf8');
 const cxkey=keys.find(k=>k.name==='PTK · Codex').key;
 await api('/api/cli-tools/codex-settings',{baseUrl:base,apiKey:cxkey,model:'cx/fixture-model',subagentModel:'cx/fixture-model'});
 const written=fs.readFileSync(configPath,'utf8');assert(written.includes('model_provider = "ptk"'));assert(written.includes('[model_providers.existing]'));assert(written.includes('requires_openai_auth = false'));assert.equal(fs.readFileSync(authPath,'utf8'),originalAuth);
 const backups=fs.readdirSync(codexHome).filter(n=>n.startsWith('config.toml.ptk-backup-'));assert(backups.some(n=>fs.readFileSync(path.join(codexHome,n),'utf8')===originalConfig));
 await api('/api/cli-tools/codex-settings',null,'DELETE');const reset=fs.readFileSync(configPath,'utf8');assert(!reset.includes('[model_providers.ptk]'));assert(reset.includes('[model_providers.existing]'));assert.equal(fs.readFileSync(authPath,'utf8'),originalAuth);passed.push('Codex config backup, PTK namespace, other provider and login preserved');
 for(const [name,model] of [['PTK · Codex','ag/gemini-3.8-flash-high'],['PTK · Antigravity','cx/gpt-5'],['PTK · Cursor AG','cx/gpt-5']]){
  const key=keys.find(k=>k.name===name).key;
  const r=await fetch(base+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'user',content:'fixture'}]})});
  assert.equal(r.status,403,name);assert((await r.json()).error); 
 }
 passed.push('all three keys block cross-provider inference');
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
 const prefix='fixture'+Date.now();
 const {node}=await api('/api/provider-nodes',{name:'PTK smoke fixture',prefix,apiType:'chat',baseUrl:`http://127.0.0.1:${mock.address().port}/v1`,type:'openai-compatible'});
 await api('/api/providers',{provider:node.id,apiKey:'synthetic-fixture-only',name:'Fixture '+prefix,testStatus:'active'});
 const key=await api('/api/keys',{name:'Smoke '+prefix});
 await api('/api/ptk/local',{action:'save-profile',id:key.id,allow:[prefix+'/*']});
 const call=async(path,body)=>{
  const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key.key},body:JSON.stringify(body)});const t=await r.text();assert(r.ok,`${path}: ${r.status} ${t.slice(0,500)}`);return t;
 };
 const body={model:prefix+'/ok',messages:[{role:'user',content:'fixture request'}],stream:false};
 const chat=JSON.parse(await call('/v1/chat/completions',body));assert.equal(chat.choices[0].message.content,'PTK fixture OK');passed.push('real HTTP chat routing to custom provider');
 const stream=await call('/v1/chat/completions',{...body,stream:true});assert(stream.includes('PTK fixture OK')&&stream.includes('[DONE]'));passed.push('SSE streaming');
 const responses=await call('/v1/responses',{model:prefix+'/ok',input:'fixture request',stream:false});assert(responses.includes('PTK fixture OK'));passed.push('Responses conversion');
 const combo='smoke-'+Date.now();await api('/api/combos',{name:combo,models:[prefix+'/fail',prefix+'/ok']});
 await api('/api/ptk/local',{action:'save-profile',id:key.id,allow:[prefix+'/*',combo]});
 const result=await call('/v1/chat/completions',{...body,model:combo});assert(result.includes('PTK fixture OK'));
 assert(mockHits.some(h=>h.model==='fail'));passed.push('combo fallback 503 to next model');
 let stats;for(let i=0;i<10;i++){stats=await api('/api/usage/stats?period=all');if(Object.keys(stats.byModel||{}).some(k=>k.includes('ok')))break;await new Promise(r=>setTimeout(r,300));}
 assert(stats.totalRequests>=4,`usage count ${stats.totalRequests}`);assert(stats.totalPromptTokens>0||Object.values(stats.byModel).some(m=>m.promptTokens>0));passed.push('usage persisted and aggregated');
 const report={ok:true,fixture:base,passed,mockHits,usage:{totalRequests:stats.totalRequests,models:Object.keys(stats.byModel||{})},timestamp:new Date().toISOString()};
 fs.mkdirSync(new URL('../data/verification/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../data/verification/smoke.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>mock.close(resolve));}
