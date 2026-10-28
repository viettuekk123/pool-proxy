import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
const conf=read(path.join(root,"ptk.config.json"));
const origin="http://127.0.0.1:"+(conf.port||21000),data=path.resolve(root,conf.dataDir||"data/engine");
const [command,...args]=process.argv.slice(2);
if(command==="start"){spawn(process.execPath,[path.join(root,"src/launch.js")],{stdio:"inherit",windowsHide:true}).on("exit",c=>process.exit(c||0));}
else if(!command||command==="help"){console.log("PTK Proxy Tools\n  node src/cli.js start\n  node src/cli.js health\n  node src/cli.js doctor\n  node src/cli.js profiles\n  node src/cli.js bootstrap\n  node src/cli.js config\n\nAdmin CLI chỉ dùng secret local của PTK; không in token đăng nhập.");}
else if(command==="config"){console.log("Launcher: "+path.join(root,"ptk.config.json")+"\nData: "+data+"\nDashboard: "+origin+"/dashboard/local-setup");}
else{
 try{
  const headers={"Content-Type":"application/json"};
  if(command!=="health"){
   const raw=fs.readFileSync(path.join(data,"machine-id"),"utf8").trim(),secret=fs.readFileSync(path.join(data,"auth/cli-secret"),"utf8").trim();
   headers["x-9r-cli-token"]=createHash("sha256").update(raw+"9r-cli-auth"+secret).digest("hex").slice(0,16);
  }
  const options={headers};let endpoint="/api/ptk/local";
  if(command==="health")endpoint="/api/health";
  else if(["doctor","bootstrap"].includes(command)){options.method="POST";options.body=JSON.stringify({action:command==="doctor"?"diagnose":"presets"});}
  else if(command!=="profiles")throw Error("Lệnh không hợp lệ. Dùng help.");
  const res=await fetch(origin+endpoint,{...options,signal:AbortSignal.timeout(20000)});
  const out=await res.json();if(!res.ok)throw Error(out.error||"HTTP "+res.status);
  console.log(JSON.stringify(out,null,2));
 }catch(e){console.error("PTK: "+e.message+"\nHãy mở PTK và đăng nhập dashboard ít nhất một lần.");process.exitCode=1;}
}
