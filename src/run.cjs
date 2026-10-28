const fs=require("fs"),path=require("path"),os=require("os"),{spawn}=require("child_process");
const root=path.resolve(__dirname,".."),[script="src/launch.js",...args]=process.argv.slice(2);
const major=Number(process.versions.node.split(".")[0]);
const candidates=[process.env.PTK_NODE,...[os.homedir(),process.env.USERPROFILE].filter(Boolean).map(p=>path.join(p,".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"))].filter(Boolean);
const minor=Number(process.versions.node.split(".")[1]);
const runtime=(major>22||(major===22&&minor>=13))?process.execPath:candidates.find(p=>fs.existsSync(p));
if(!runtime){console.error("PTK cần Node.js 22.13+ hoặc 24. Cài Node mới hoặc đặt PTK_NODE tới node.exe.");process.exit(1);}
const child=spawn(runtime,[path.resolve(root,script),...args],{cwd:root,stdio:"inherit",windowsHide:true});
child.on("error",e=>{console.error(e.message);process.exitCode=1;});child.on("exit",c=>process.exit(c||0));for(const s of ["SIGINT","SIGTERM"])process.on(s,()=>child.kill(s));
