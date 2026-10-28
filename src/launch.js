import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),engine=path.join(root,"engine");
const configPath=path.join(root,"ptk.config.json");
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,"utf8").replace(/^\uFEFF/,"")):{port:21000};
const port=Number(config.port||21000);if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Port PTK phải từ 1024 đến 65535.");
if(!fs.existsSync(path.join(engine,".next/BUILD_ID"))){console.error("Chưa build PTK. Chạy npm run setup, sau đó npm run build.");process.exit(1);}
await new Promise((ok,no)=>{const s=net.createServer();s.once("error",()=>no(Error("Port "+port+" đang được dùng; đổi ptk.config.json. PTK không tự dừng process khác.")));s.listen(port,"127.0.0.1",()=>s.close(ok));});
const data=path.resolve(root,config.dataDir||"data/engine");fs.mkdirSync(data,{recursive:true});
const env={...process.env,DATA_DIR:data,PORT:String(port),HOSTNAME:"127.0.0.1",PTK_BASE_URL:"http://127.0.0.1:"+port,PTK_CONFIG_PATH:configPath,PTK_LOCAL_ONLY:"1",PTK_MITM_DNS:config.mitmDns||"system",NEXT_TELEMETRY_DISABLED:"1",ENABLE_REQUEST_LOGS:"false",ENABLE_TRANSLATOR:"false",MITM_SERVER_PATH:path.join(engine,"src/mitm/server.js")};
console.log("PTK Proxy Tools · Local\nDashboard: http://127.0.0.1:"+port+"/dashboard/local-setup\nAPI: http://127.0.0.1:"+port+"/v1\nData: "+data+"\nĐăng nhập local lần đầu: 123456; đổi mật khẩu trong Settings.\nCtrl+C để dừng.");
const child=spawn(process.execPath,[path.join(engine,"custom-server.js"),"--port",String(port),"--hostname","127.0.0.1"],{cwd:engine,env,stdio:"inherit",windowsHide:true});
child.on("exit",code=>process.exit(code||0));
for(const s of ["SIGINT","SIGTERM"])process.on(s,()=>child.kill(s));
