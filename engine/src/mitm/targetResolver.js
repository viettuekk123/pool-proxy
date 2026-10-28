const net=require("node:net");
function createTargetResolver({mode="system",fetchImpl=global.fetch,resolve4=require("node:dns").promises.resolve4,now=Date.now}={}){
 const cache=new Map();
 if(!["system","google-doh"].includes(mode))throw Error("Unsupported PTK MITM DNS mode");
 return async function resolveTargetIP(hostname){
  const previous=cache.get(hostname);if(previous&&now()-previous.ts<300000)return previous.ip;
  let ip;
  if(mode==="google-doh"){
   const r=await fetchImpl("https://dns.google/resolve?name="+encodeURIComponent(hostname)+"&type=A",{signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error("DNS HTTPS returned "+r.status);
   const body=await r.json();ip=body.Answer?.find(a=>a.type===1)?.data;
  }else ip=(await resolve4(hostname))[0];
  if(!ip||!net.isIPv4(ip))throw Error("DNS returned no valid upstream IPv4 address");
  cache.set(hostname,{ip,ts:now()});return ip;
 };
}
module.exports={createTargetResolver};
