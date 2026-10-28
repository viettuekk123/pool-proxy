import {NextResponse} from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import dns from "node:dns/promises";
import {DATA_DIR} from "@/lib/dataDir";
import {getApiKeys,createApiKey,updateApiKey,getProviderConnections,createProviderConnection,updateSettings,getSettings,setModelAlias,getModelAliases,setMitmAliasAll,getMitmAlias,exportDb} from "@/lib/localDb";
import {getConsistentMachineId} from "@/shared/utils/machineId";
import {PROVIDER_MODELS} from "@/shared/constants/models";
import {validateKeyAccessInput} from "@/shared/utils/keyAccess";
import {syncToJson} from "@/lib/mitmAliasCache";
export const dynamic="force-dynamic";
const presets=[{app:"codex",name:"PTK · Codex",provider:"cx"},{app:"antigravity",name:"PTK · Antigravity",provider:"ag"},{app:"cursor",name:"PTK · Cursor AG",provider:"ag"}];
const sourcePath=()=>path.join(process.env.APPDATA||path.join(os.homedir(),"AppData/Roaming"),"9router/db/data.sqlite");
const safeKeys=keys=>keys.map(({key,...k})=>({...k,tail:key?.slice(-4)}));
async function port(n){return new Promise(resolve=>{const s=net.connect(n,"127.0.0.1");s.setTimeout(1000);s.once("connect",()=>{s.destroy();resolve({port:n,ok:true});});for(const e of ["error","timeout"])s.once(e,()=>{s.destroy();resolve({port:n,ok:false});});});}
async function sourceDB(){const p=sourcePath();if(!fs.existsSync(p))throw new Error("Không tìm thấy database router cũ trên máy.");let DatabaseSync;try{({DatabaseSync}=await import("node:sqlite"));}catch{throw new Error("Import cần Node.js 22.13+ hoặc 24. Chạy PTK bằng runtime mới.");}return new DatabaseSync(p,{readOnly:true});}
async function backup(){const dir=path.join(DATA_DIR,"backups");fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,"ptk-before-change-"+Date.now()+".json");fs.writeFileSync(dest,JSON.stringify(await exportDb()),{mode:0o600});return dest;}
export async function GET(){
 try{
  await getConsistentMachineId("9r-cli-auth");
  const [keys,conns,settings,aliases]=await Promise.all([getApiKeys(),getProviderConnections(),getSettings(),getModelAliases()]);
  return NextResponse.json({dataDir:DATA_DIR,keys:safeKeys(keys),connections:conns.map(c=>({id:c.id,provider:c.provider,name:c.name,isActive:c.isActive,testStatus:c.testStatus})),profiles:presets.map(p=>({...p,key:keys.find(k=>k.name===p.name)?safeKeys([keys.find(k=>k.name===p.name)])[0]:null})),runtime:{port:Number(process.env.PORT)||21000,mitmDns:process.env.PTK_MITM_DNS||"system",configPath:process.env.PTK_CONFIG_PATH||null},mitmKeyId:settings.ptkMitmKeyId||null,mitmRouterBaseUrl:settings.mitmRouterBaseUrl,aliases,sourceAvailable:fs.existsSync(sourcePath()),sourcePath:sourcePath(),localOnly:true});
 }catch(e){return NextResponse.json({error:e.message},{status:500});}
}
export async function POST(request){
 try{
  const b=await request.json();
  if(b.action==="save-runtime"){
   const port=Number(b.port),mitmDns=b.mitmDns;
   if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Port phải từ 1024 đến 65535.");
   if(!["system","google-doh"].includes(mitmDns))throw Error("DNS mode không hợp lệ.");
   const p=process.env.PTK_CONFIG_PATH;if(!p)throw Error("Chạy qua start.cmd để chỉnh cấu hình launcher.");
   const conf=JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
   fs.copyFileSync(p,p+".bak");fs.writeFileSync(p,JSON.stringify({...conf,port,mitmDns},null,2)+"\n");
   return NextResponse.json({ok:true,message:"Đã lưu ptk.config.json. Dừng PTK rồi mở lại để áp dụng port/DNS mới."});
  }
  if(b.action==="presets"){
   await backup();const keys=await getApiKeys(),machine=await getConsistentMachineId(),created=[];
   let mitmId;
   for(const p of presets){let k=keys.find(k=>k.name===p.name);if(!k){k=await createApiKey(p.name,machine);created.push({app:p.app,key:k.key});}
    await updateApiKey(k.id,{access:{restricted:true,allow:[p.provider+"/*"]},isActive:true});if(p.app==="antigravity")mitmId=k.id;
   }
   for(const m of PROVIDER_MODELS.cx||[])await setModelAlias(m.id,"cx/"+m.id);
   const mappings={...(await getMitmAlias("antigravity"))};
   for(const m of PROVIDER_MODELS.ag||[])mappings[m.id]="ag/"+m.id;
   Object.assign(mappings,{"claude-sonnet-4.6":"ag/claude-sonnet-4-6","claude-sonnet-4.6-thinking":"ag/claude-sonnet-4-6","claude-opus-4.6":"ag/claude-opus-4-6-thinking","claude-opus-4.6-thinking":"ag/claude-opus-4-6-thinking"});
   await setMitmAliasAll("antigravity",mappings);await syncToJson();
   await updateSettings({ptkMitmKeyId:mitmId,mitmRouterBaseUrl:process.env.PTK_BASE_URL||"http://127.0.0.1:21000"});
   return NextResponse.json({ok:true,created,message:"Đã tạo key riêng, scope provider tự nhận model mới, alias và key MITM cố định. Chưa đổi cấu hình ứng dụng/hosts."});
  }
  if(b.action==="save-profile"){
   const key=(await getApiKeys()).find(k=>k.id===b.id);if(!key)return NextResponse.json({error:"Key không tồn tại"},{status:404});
   const v=validateKeyAccessInput({restricted:true,allow:b.allow});if(!v.ok)throw new Error(v.error);
   await updateApiKey(key.id,{access:v.value,isActive:b.enabled!==false});return NextResponse.json({ok:true});
  }
  if(b.action==="diagnose"){
   const ports=await Promise.all([port(Number(process.env.PORT)||21000),port(443),port(20128)]);
   const domains=await Promise.all(["daily-cloudcode-pa.googleapis.com","cloudcode-pa.googleapis.com"].map(async host=>{try{return{host,address:(await dns.lookup(host)).address};}catch{return{host,error:"Không resolve được"};}}));
   return NextResponse.json({ports,domains,message:"Nếu domain về 127.0.0.1 nhưng port 443 tắt: khởi động MITM hoặc tắt chuyển hướng trong trang MITM. HTTP 403: kiểm tra key đang chọn và scope provider."});
  }
  if(b.action==="preview-import"){
   const db=await sourceDB();try{return NextResponse.json({connections:db.prepare("SELECT provider,COUNT(*) AS count FROM providerConnections GROUP BY provider").all()});}finally{db.close();}
  }
  if(b.action==="import"){
   if(!Array.isArray(b.providers)||!b.providers.length||b.providers.some(p=>!["codex","antigravity"].includes(p)))throw new Error("Chọn Codex và/hoặc Antigravity.");
   const db=await sourceDB();let rows;try{rows=db.prepare("SELECT * FROM providerConnections").all().filter(r=>b.providers.includes(r.provider));}finally{db.close();}
   const backupPath=await backup();const existing=await getProviderConnections();let count=0,skipped=0;
   for(const r of rows){if(existing.some(x=>x.provider===r.provider&&(x.email||x.name)===(r.email||r.name))){skipped++;continue;}
    const extra=JSON.parse(r.data||"{}");
    // Copy credentials only; never inherit provider cooldown, proxies, or error state.
    const clean={};if(extra.providerSpecificData){clean.providerSpecificData={};for(const k of ["chatgptAccountId","accountId","organizationId","projectId","planType"])if(extra.providerSpecificData[k]!==undefined)clean.providerSpecificData[k]=extra.providerSpecificData[k];}for(const k of ["accessToken","refreshToken","expiresAt","tokenType","scope","projectId","apiKey","expiresIn","idToken"])if(extra[k]!==undefined)clean[k]=extra[k];
    const imported=await createProviderConnection({...clean,provider:r.provider,authType:r.authType,name:r.name,email:r.email,isActive:false,testStatus:"unknown"});existing.push(imported);count++;
   }
   return NextResponse.json({ok:true,imported:count,skipped,backupPath,message:"Đã sao chép tài khoản vào data PTK; database nguồn chỉ được đọc. Tài khoản nhập ở trạng thái TẮT. Dừng router cũ trước khi bật để tránh refresh token xoay vòng xung đột."});
  }
  throw new Error("Action không hợp lệ.");
 }catch(e){return NextResponse.json({error:e.message},{status:400});}
}
