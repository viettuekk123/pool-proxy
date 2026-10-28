import{describe,it,expect,vi}from"vitest";
import{createRequire}from"node:module";
const require=createRequire(import.meta.url);
const{createTargetResolver}=require("../../src/mitm/targetResolver.js");
describe("PTK MITM DNS",()=>{
 it("uses only chosen HTTPS resolver and caches validated answers",async()=>{
  const fetchImpl=vi.fn(async()=>({ok:true,json:async()=>({Answer:[{type:5,data:"alias"},{type:1,data:"1.2.3.4"}]})}));
  const resolve4=vi.fn();let time=1;
  const resolve=createTargetResolver({mode:"google-doh",fetchImpl,resolve4,now:()=>time});
  expect(await resolve("daily-cloudcode-pa.googleapis.com")).toBe("1.2.3.4");
  expect(await resolve("daily-cloudcode-pa.googleapis.com")).toBe("1.2.3.4");
  expect(fetchImpl).toHaveBeenCalledTimes(1);expect(resolve4).not.toHaveBeenCalled();
  expect(fetchImpl.mock.calls[0][0]).toBe("https://dns.google/resolve?name=daily-cloudcode-pa.googleapis.com&type=A");
  time+=300001;await resolve("daily-cloudcode-pa.googleapis.com");expect(fetchImpl).toHaveBeenCalledTimes(2);
 });
 it("system mode makes no HTTPS DNS calls",async()=>{
  const fetchImpl=vi.fn(),resolve=createTargetResolver({mode:"system",fetchImpl,resolve4:async()=>["8.8.4.4"]});
  expect(await resolve("example.com")).toBe("8.8.4.4");expect(fetchImpl).not.toHaveBeenCalled();
 });
 it("rejects invalid or failed responses instead of connecting to local hosts",async()=>{
  const resolve=createTargetResolver({mode:"google-doh",fetchImpl:async()=>({ok:true,json:async()=>({Answer:[{type:1,data:"not-ip"}]})})});
  await expect(resolve("example.com")).rejects.toThrow("valid upstream IPv4");
 });
});

const {removeOwnedHostEntries}=require("../../src/mitm/dns/ownedHosts.js");
describe("PTK hosts ownership",()=>{
 it("preserves user and other router entries byte for byte",()=>{
  const text="127.0.0.1 localhost\r\n127.0.0.1 api.example.com # old-router\n\n  ";
  expect(removeOwnedHostEntries(text,["api.example.com"])).toBe(text);
 });
 it("removes only exact PTK host entries",()=>{
  const old="127.0.0.1 api.example.com # old-router\r\n";
  const own="127.0.0.1 api.example.com # PTK-Proxy-Tools\r\n";
  const other="127.0.0.1 other.api.example.com # PTK-Proxy-Tools\n";
  expect(removeOwnedHostEntries(old+own+other,["api.example.com"])).toBe(old+other);
 });
});
