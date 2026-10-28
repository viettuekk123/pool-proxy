import {describe,it,expect,vi} from "vitest";
const fx=vi.hoisted(()=>({keys:{},aliases:{flash:"ag/gemini-3.8-flash-high",gpt:"cx/gpt-6.1-sol"}}));
vi.mock("@/lib/localDb",()=>({getModelAliases:async()=>fx.aliases,getComboByName:async()=>null,getProviderNodes:async()=>[]}));
vi.mock("@/lib/db/repos/combosRepo.js",()=>({getCombos:async()=>[]}));
vi.mock("@/lib/db/repos/apiKeysRepo.js",()=>({getApiKeyByKey:async key=>fx.keys[key]}));
vi.mock("@/sse/utils/logger.js",()=>({warn:vi.fn(),info:vi.fn(),debug:vi.fn(),error:vi.fn()}));
const engine=await import("../../src/sse/services/keyAccess.js");
const ctx=async allow=>{fx.keys.test={id:"test",name:"test",access:{restricted:true,allow}};return engine.getKeyAccessContext(new Request("http://localhost/v1/chat/completions",{headers:{authorization:"Bearer test"}}));};
describe("PTK provider scopes",()=>{
 it("Codex grants future Codex models but rejects Gemini aliases",async()=>{
  const c=await ctx(["cx/*"]);
  expect(await engine.enforceKeyAccess(c,"cx/future-model")).toBeNull();
  expect(await engine.enforceKeyAccess(c,"gpt")).toBeNull();
  expect((await engine.enforceKeyAccess(c,"flash")).status).toBe(403);
  expect((await engine.enforceKeyAccess(c,"openai/gpt")).status).toBe(403);
 });
 it("Antigravity accepts both 4.6 models and future ids",async()=>{
  const c=await ctx(["ag/*"]);
  for(const m of ["ag/claude-opus-4-6-thinking","ag/claude-sonnet-4-6","ag/future","flash"])expect(await engine.enforceKeyAccess(c,m)).toBeNull();
  expect((await engine.enforceKeyAccess(c,"gpt")).status).toBe(403);
 });
 it("resolved gates and model listing respect provider scopes",async()=>{
  const c=await ctx(["ag/*"]);
  expect(await engine.enforceKeyAccessResolved(c,"x","antigravity","future")).toBeNull();
  expect((await engine.enforceKeyAccessResolved(c,"x","codex","gpt")).status).toBe(403);
  expect(await engine.filterModelsListForKey(c,[{id:"ag/future"},{id:"cx/gpt"}])).toEqual([{id:"ag/future"}]);
 });
 it("wildcards cannot bypass empty or invalid scopes",async()=>{
  for(const allow of [[],["*"],["ag*"],["ag/*/cx"]]){
   const c=await ctx(allow);expect((await engine.enforceKeyAccess(c,"cx/future")).status).toBe(403);
  }
 });
});
