import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRuntime} from '../src/server.js';
test('profile isolation, aliases, streaming, failover, rotation and persistence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ptk-test-')),received=[];
 const upstream=http.createServer(async(req,res)=>{
  let raw='';for await(const c of req)raw+=c;
  const payload=raw?JSON.parse(raw):{};
  received.push({path:req.url,auth:req.headers.authorization,model:payload.model});
  if(req.url.startsWith('/bad/')){res.writeHead(429);res.end('quota');return;}
  if(req.url==='/good/models'){res.writeHead(200);res.end('{"data":[]}');return;}
  res.writeHead(200,{'content-type':'text/event-stream'});
  res.write('data: first\n\n');setTimeout(()=>res.end('data: [DONE]\n\n'),100);
 });
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+upstream.address().port;
 const config={listen:{host:'127.0.0.1',port:21000},upstreams:[{id:'bad',baseUrl:origin+'/bad',enabled:true},{id:'good',baseUrl:origin+'/good',enabled:true,stripPrefix:'ag/'}],profiles:[{id:'ag',allow:['ag/*'],upstreams:['bad','good'],strategy:'priority'},{id:'cx',allow:['cx/*'],upstreams:['good'],strategy:'priority'}],aliases:{sonnet:'ag/sonnet',gpt:'cx/gpt'}};
 await writeFile(join(dir,'config.json'),JSON.stringify(config));
 let runtime=await createRuntime({directory:dir,portOverride:0});
 let admin=async(path,method='GET',body)=>fetch(runtime.origin+'/admin/'+path,{method,headers:{authorization:'Bearer '+runtime.adminToken,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await fetch(runtime.origin+'/admin/state')).status,401);
  assert.equal((await fetch(runtime.origin+'/admin/state',{headers:{authorization:'Bearer '+runtime.adminToken,origin:'https://evil.example'}})).status,403);
  assert.equal(await new Promise((ok,no)=>{const q=http.get(runtime.origin+'/health',{headers:{host:'evil.example'}},r=>{r.resume();ok(r.statusCode);});q.on('error',no);}),403);
  assert.equal((await fetch(runtime.origin+'/')).status,200);
  assert.equal((await fetch(runtime.origin+'/app.js')).status,200);
  assert.equal((await fetch(runtime.origin+'/v1/models')).status,401);
  let r=await admin('config','PUT',{config,keys:{good:'upstream-secret'}});assert.equal(r.status,200);
  const ag=(await (await admin('key','POST',{profile:'ag'})).json()).key;
  const cx=(await (await admin('key','POST',{profile:'cx'})).json()).key;
  const call=(key,model)=>fetch(runtime.origin+'/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:'PRIVATE_PROMPT'}],stream:true})});
  assert.equal((await call(cx,'sonnet')).status,403);
  r=await call(ag,'sonnet');assert.equal(r.status,200);assert.equal(r.headers.get('x-ptk-upstream'),'good');
  const reader=r.body.getReader(),first=await reader.read();assert.match(Buffer.from(first.value).toString(),/first/);
  let rest='';for(;;){const x=await reader.read();if(x.done)break;rest+=Buffer.from(x.value);}assert.match(rest,/DONE/);
  assert.equal(received[0].path,'/bad/chat/completions');
  assert.equal(received[1].path,'/good/chat/completions');assert.equal(received[1].auth,'Bearer upstream-secret');assert.equal(received[1].model,'sonnet');
  const count=received.length;r=await call(ag,'sonnet');await r.text();assert.equal(received.length,count+1);
  const snap=await (await admin('state')).json();assert.equal(snap.config.upstreams[1].hasKey,true);assert.ok(!JSON.stringify(snap).includes('upstream-secret'));assert.ok(!JSON.stringify(snap).includes('PRIVATE_PROMPT'));
  assert.equal((await admin('probe','POST',{upstream:'good'})).status,200);
  const ag2=(await (await admin('key','POST',{profile:'ag'})).json()).key;
  assert.equal((await call(ag,'sonnet')).status,401);
  const stored=await readFile(join(dir,'data/secrets.json'),'utf8');assert.ok(!stored.includes(ag2));assert.ok(!stored.includes(cx));
  const bad=structuredClone(config);bad.profiles[0].upstreams=['missing'];assert.equal((await admin('config','PUT',{config:bad})).status,400);
  await runtime.close();runtime=await createRuntime({directory:dir,portOverride:0});
  r=await call(ag2,'sonnet');assert.equal(r.status,200);await r.text();
  assert.equal((await admin('state')).status,200);
 }finally{await runtime.close();await new Promise(r=>{upstream.closeAllConnections();upstream.close(r);});await rm(dir,{recursive:true,force:true});}
});

test('round-robin preserves Responses, and permission errors never fail over',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ptk-pool-')),calls=[];
 const upstream=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;calls.push(req.url);const p=JSON.parse(raw);res.writeHead(p.model==='ag/denied'?403:200,{'content-type':'application/json'});res.end(JSON.stringify({path:req.url}));});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+upstream.address().port;
 const config={listen:{host:'127.0.0.1',port:21000},upstreams:[{id:'a',baseUrl:base+'/a'},{id:'b',baseUrl:base+'/b'}],profiles:[{id:'pool',allow:['ag/*'],upstreams:['a','b'],strategy:'round-robin'}],aliases:{}};
 await writeFile(join(dir,'config.json'),JSON.stringify(config));
 const r=await createRuntime({directory:dir,portOverride:0});
 try{
  const k=await fetch(r.origin+'/admin/key',{method:'POST',headers:{authorization:'Bearer '+r.adminToken,'content-type':'application/json'},body:JSON.stringify({profile:'pool'})});
  const {key}=await k.json();
  const call=model=>fetch(r.origin+'/v1/responses',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,input:'hello'})});
  let out=await call('ag/model');assert.equal(out.status,200);assert.equal((await out.json()).path,'/a/responses');
  out=await call('ag/model');assert.equal(out.status,200);assert.equal((await out.json()).path,'/b/responses');
  const count=calls.length;out=await call('ag/denied');assert.equal(out.status,403);await out.text();assert.equal(calls.length,count+1);
 }finally{await r.close();await new Promise(ok=>{upstream.closeAllConnections();upstream.close(ok);});await rm(dir,{recursive:true,force:true});}
});
