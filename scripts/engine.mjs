import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),engine=path.join(root,"engine");
function run(cmd,args,env){return new Promise((ok,no)=>{const p=spawn(cmd,args,{cwd:engine,env:env||process.env,stdio:"inherit",shell:process.platform==="win32"&&cmd==="npm",windowsHide:true});p.once("error",no);p.once("exit",c=>c===0?ok():no(Error("Exit "+c)));});}
const action=process.argv[2];
if(action==="setup")await run("npm",["ci","--ignore-scripts","--no-audit","--no-fund","--legacy-peer-deps"]);
else if(action==="build"){
 const env={...process.env,NEXT_TELEMETRY_DISABLED:"1",DATA_DIR:path.join(root,"data/build")};
 await run(process.execPath,[path.join(engine,"node_modules/next/dist/bin/next"),"build","--webpack"],env);
}else throw Error("setup hoặc build");
