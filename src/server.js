import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const here=dirname(fileURLToPath(import.meta.url));
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const matches=(p,m)=>p==='*'||(p.endsWith('*')?m.startsWith(p.slice(0,-1)):p===m);
const fail=(status,message,type='configuration_error')=>Object.assign(new Error(message),{status,type});
const empty=()=>({listen:{host:'127.0.0.1',port:21000},upstreams:[],profiles:[],aliases:{}});
function validate(c){
 if(!['127.0.0.1','::1'].includes(c.listen?.host))throw fail(400,'Chỉ hỗ trợ địa chỉ loopback local.');
 if(!Number.isInteger(c.listen.port)||c.listen.port<1||c.listen.port>65535)throw fail(400,'Port không hợp lệ.');
 if(!Array.isArray(c.upstreams)||!Array.isArray(c.profiles)||!c.aliases||typeof c.aliases!=='object'||Array.isArray(c.aliases))throw fail(400,'Cấu hình không đúng định dạng.');
 for(const list of [c.upstreams,c.profiles]){const ids=new Set();for(const item of list){if(!/^[a-zA-Z0-9_-]{1,60}$/.test(item.id)||ids.has(item.id))throw fail(400,'ID phải duy nhất, gồm chữ/số/gạch ngang.');ids.add(item.id);}}
 for(const u of c.upstreams){
  let url;try{url=new URL(u.baseUrl);}catch{throw fail(400,'URL upstream không hợp lệ.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw fail(400,'URL không được chứa mật khẩu/query/hash.');
  if(u.timeoutMs!=null&&(!Number.isInteger(u.timeoutMs)||u.timeoutMs<100||u.timeoutMs>600000))throw fail(400,'Timeout phải từ 100 đến 600000ms.');
  if(u.stripPrefix!=null&&typeof u.stripPrefix!=='string')throw fail(400,'stripPrefix phải là chuỗi.');
 }
 for(const p of c.profiles){
  if(!Array.isArray(p.allow)||!p.allow.length||p.allow.some(x=>typeof x!=='string'||!x))throw fail(400,'Profile cần ít nhất một model/prefix được phép.');
  if(!Array.isArray(p.upstreams)||!p.upstreams.length||p.upstreams.some(id=>!c.upstreams.some(u=>u.id===id)))throw fail(400,'Profile phải trỏ tới upstream tồn tại.');
  if(!['priority','round-robin'].includes(p.strategy))throw fail(400,'Chiến lược phải là priority hoặc round-robin.');
 }
 if(Object.entries(c.aliases).some(([a,b])=>!a||typeof b!=='string'||!b))throw fail(400,'Alias phải ánh xạ tên model sang ID.');
 return c;
}
export async function createRuntime({directory=resolve(here,'..'),portOverride}={}){
 const configFile=resolve(directory,'config.json'),secretsFile=resolve(directory,'data/secrets.json');
 await mkdir(dirname(secretsFile),{recursive:true});
 async function readJSON(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
 async function atomic(path,value){await writeFile(path+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(path+'.tmp',path);}
 let config=validate(await readJSON(configFile,empty()));
 let secrets=await readJSON(secretsFile,{upstreams:{},profiles:{}});
 const adminToken=token(),startedAt=Date.now(),events=[],circuits=new Map(),cursors=new Map();
 let writing=Promise.resolve();
 async function commit(next,nextSecrets){const task=writing.then(async()=>{validate(next);await atomic(secretsFile,nextSecrets);await atomic(configFile,next);config=next;secrets=nextSecrets;});writing=task.catch(()=>{});return task;}
 function emit(e){events.unshift({time:new Date().toISOString(),...e});events.splice(200);}
 const keyFor=u=>secrets.upstreams[u.id]||(u.apiKeyEnv?process.env[u.apiKeyEnv]:'')||'';
 const view=()=>({...config,upstreams:config.upstreams.map(u=>({...u,hasKey:Boolean(keyFor(u)),circuit:circuits.get(u.id)||null})),profiles:config.profiles.map(p=>({...p,hasKey:Boolean(secrets.profiles[p.id])}))});
 function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
 async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024)throw fail(413,'Request vượt giới hạn 8 MB.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw fail(400,'Body JSON không hợp lệ.');}}
 let address;
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!==address?.host)throw fail(403,'Host không hợp lệ.');
   const url=new URL(req.url,address.origin);
   if(req.headers.origin&&req.headers.origin!==address.origin)throw fail(403,'Origin không hợp lệ.');
   res.setHeader('referrer-policy','no-referrer');res.setHeader('x-frame-options','DENY');
   if(req.method==='GET'&&['/','/app.js','/style.css'].includes(url.pathname)){
    res.setHeader('content-type',url.pathname==='/'?'text/html; charset=utf-8':url.pathname.endsWith('.js')?'text/javascript':'text/css');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'");
    return res.end(await readFile(resolve(here,'../public',url.pathname==='/'?'index.html':url.pathname.slice(1))));
   }
   if(url.pathname==='/health'&&req.method==='GET')return json(res,200,{ok:true,name:'PTK Proxy Tools',uptimeMs:Date.now()-startedAt});
   if(url.pathname.startsWith('/admin/')){
    if(!equal(req.headers.authorization,'Bearer '+adminToken))throw fail(401,'Mở dashboard bằng đường dẫn có mã quản trị trong terminal.');
    if(url.pathname==='/admin/state'&&req.method==='GET')return json(res,200,{config:view(),events,configPath:configFile,endpoint:address.origin+'/v1'});
    if(url.pathname==='/admin/config'&&req.method==='PUT'){
     const input=await body(req),next=validate(input.config),ns=structuredClone(secrets);
     for(const [id,key]of Object.entries(input.keys||{})){if(!next.upstreams.some(u=>u.id===id)||typeof key!=='string')throw fail(400,'Key upstream không hợp lệ.');if(key)ns.upstreams[id]=key;}
     for(const u of next.upstreams){delete u.apiKey;delete u.hasKey;delete u.circuit;}
     for(const p of next.profiles){delete p.hasKey;delete p.apiKey;}
     if(JSON.stringify(next.listen)!==JSON.stringify(config.listen))throw fail(400,'Đổi listen trong config.json rồi khởi động lại.');
     await commit(next,ns);return json(res,200,{ok:true});
    }
    if(url.pathname==='/admin/key'&&req.method==='POST'){
     const {profile}=await body(req);if(!config.profiles.some(p=>p.id===profile))throw fail(404,'Không tìm thấy profile.');
     const key='ptk_'+token(),ns=structuredClone(secrets);ns.profiles[profile]=hash(key);await commit(config,ns);
     return json(res,200,{key,message:'Key chỉ hiển thị một lần. Key cũ đã bị thu hồi.'});
    }
    if(url.pathname==='/admin/probe'&&req.method==='POST'){
     const {upstream}=await body(req),u=config.upstreams.find(u=>u.id===upstream);if(!u)throw fail(404,'Upstream không tồn tại.');
     try{const key=keyFor(u),r=await fetch(u.baseUrl.replace(/\/$/,'')+'/models',{headers:key?{authorization:'Bearer '+key}:{},signal:AbortSignal.timeout(8000)});await r.body?.cancel();return json(res,200,{ok:r.ok,status:r.status,message:r.ok?'Kết nối được. Chưa xác nhận quyền inference.':'Upstream trả HTTP '+r.status+'; kiểm tra key và endpoint.'});}
     catch{return json(res,200,{ok:false,message:'Không kết nối được trong 8 giây. Kiểm tra app router, port và URL.'});}
    }
    throw fail(404,'Không có thao tác quản trị này.');
   }
   if(!url.pathname.startsWith('/v1/'))throw fail(404,'Endpoint không tồn tại.');
   const supplied=req.headers.authorization?.replace(/^Bearer /,'')||'';
   const profile=config.profiles.find(p=>p.enabled!==false&&equal(secrets.profiles[p.id],hash(supplied)));
   if(!supplied||!profile)throw fail(401,'Key PTK không hợp lệ hoặc profile đã tắt.','authentication_error');
   if(url.pathname==='/v1/models'&&req.method==='GET'){
    const ids=[...new Set([...Object.values(config.aliases),...profile.allow.filter(x=>!x.includes('*'))])].filter(m=>profile.allow.some(p=>matches(p,m)));
    return json(res,200,{object:'list',data:ids.map(id=>({id,object:'model',owned_by:'ptk'}))});
   }
   if(req.method!=='POST'||!['/v1/chat/completions','/v1/responses','/v1/embeddings'].includes(url.pathname))throw fail(404,'Hỗ trợ chat/completions, responses và embeddings.');
   const payload=await body(req);if(typeof payload.model!=='string'||!payload.model)throw fail(400,'Thiếu model.');
   const model=Object.hasOwn(config.aliases,payload.model)?config.aliases[payload.model]:payload.model;
   if(!profile.allow.some(p=>matches(p,model)))throw fail(403,"Profile '"+profile.id+"' không được dùng '"+model+"'. Sửa Allowed models trong dashboard.",'permission_error');
   let candidates=profile.upstreams.map(id=>config.upstreams.find(u=>u.id===id)).filter(u=>u?.enabled!==false);
   if(profile.strategy==='round-robin'&&candidates.length){const n=(cursors.get(profile.id)||0)%candidates.length;cursors.set(profile.id,n+1);candidates=[...candidates.slice(n),...candidates.slice(0,n)];}
   candidates=candidates.filter(u=>(circuits.get(u.id)?.until||0)<=Date.now());
   if(!candidates.length)throw fail(503,'Không có upstream hoạt động. Kiểm tra Providers hoặc chờ cooldown.');
   for(let i=0;i<candidates.length;i++){
    const u=candidates[i],begin=Date.now(),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),u.timeoutMs||120000);timer.unref();
    const onClose=()=>abort.abort();res.once('close',onClose);
    try{
     const target=u.baseUrl.replace(/\/$/,'')+url.pathname.slice(3)+url.search;
     const outModel=u.stripPrefix&&model.startsWith(u.stripPrefix)?model.slice(u.stripPrefix.length):model,key=keyFor(u);
     const upstream=await fetch(target,{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},body:JSON.stringify({...payload,model:outModel}),signal:abort.signal});
     if([429,502,503,504].includes(upstream.status)){
      const seconds=Number(upstream.headers.get('retry-after'));
      circuits.set(u.id,{until:Date.now()+Math.min(120000,Number.isFinite(seconds)&&seconds>0?seconds*1000:15000),status:upstream.status});
      emit({profile:profile.id,upstream:u.id,model,status:upstream.status,ms:Date.now()-begin,action:i<candidates.length-1?'failover':'returned'});
      if(i<candidates.length-1){await upstream.body?.cancel();continue;}
     }else emit({profile:profile.id,upstream:u.id,model,status:upstream.status,ms:Date.now()-begin});
     if(upstream.ok)circuits.delete(u.id);
     res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'no-store','x-ptk-upstream':u.id});
     if(upstream.body)await pipeline(Readable.fromWeb(upstream.body),res);else res.end();return;
    }catch(e){
     emit({profile:profile.id,upstream:u.id,model,status:502,ms:Date.now()-begin,error:e.name==='AbortError'?'timeout_or_cancelled':'transport_error'});
     if(res.headersSent){res.destroy();return;}
     throw fail(502,'Kết nối/timeout upstream. Không tự gửi lại request chưa rõ trạng thái để tránh tính phí hai lần.','upstream_error');
    }finally{clearTimeout(timer);res.off('close',onClose);}
   }
  }catch(e){if(res.headersSent)res.destroy();else json(res,e.status||500,{error:{type:e.type||'internal_error',message:e.status?e.message:'Lỗi nội bộ PTK. Kiểm tra cấu hình local.'}});}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(portOverride??config.listen.port,config.listen.host,ok);});
 const host=(config.listen.host==='::1'?'[::1]':config.listen.host)+':'+server.address().port;address={host,origin:'http://'+host};
 return{server,origin:address.origin,adminToken,close:()=>new Promise(r=>{server.closeAllConnections();server.close(r);})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createRuntime().then(r=>{console.log('PTK Proxy Tools\nDashboard: '+r.origin+'/#'+r.adminToken+'\nAPI: '+r.origin+'/v1\nCtrl+C để dừng. Giữ kín mã quản trị dashboard.');for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>r.close().then(()=>process.exit(0)));}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
