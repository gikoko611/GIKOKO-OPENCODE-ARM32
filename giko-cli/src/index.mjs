#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {randomUUID} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const exec=promisify(execFile), VERSION="0.1.1", ROOT=process.cwd();
const CFG=path.join(os.homedir(),".config","giko-koko","config.json");
const DEFAULT_BASE=process.env.GIKO_BASE_URL||"https://opencode.ai/inference/openai/v1";
const DEFAULT_MODEL=process.env.GIKO_MODEL||"opencode/glm-5.3-flash-free";
const C={gold:"\x1b[38;5;220m",green:"\x1b[38;5;114m",red:"\x1b[38;5;203m",dim:"\x1b[2m",reset:"\x1b[0m"};
const ok=s=>console.log(C.green+"✓ "+s+C.reset), fail=s=>console.log(C.red+"✗ "+s+C.reset), warn=s=>console.log(C.gold+"! "+s+C.reset);

async function ensure(){try{await fs.access(CFG)}catch{await fs.mkdir(path.dirname(CFG),{recursive:true});await fs.writeFile(CFG,JSON.stringify({baseURL:DEFAULT_BASE,model:DEFAULT_MODEL,apiKey:null},null,2)+"\n")}}
async function cfg(){await ensure();return JSON.parse(await fs.readFile(CFG,"utf8"))}
async function save(c){await fs.writeFile(CFG,JSON.stringify(c,null,2)+"\n")}
const sid=()=> "ses_"+randomUUID().replaceAll("-","").slice(0,26);

async function catalog(){
  const r=await fetch("https://models.dev/api.json",{headers:{accept:"application/json","user-agent":"giko-koko-cli/"+VERSION}});
  if(!r.ok)throw new Error("models.dev HTTP "+r.status);
  return await r.json();
}
async function listModels(){
  const d=await catalog(), p=d.opencode;
  if(!p?.models)throw new Error("OpenCode provider catalog not found");
  let n=0;
  for(const [id,m] of Object.entries(p.models)){
    const input=Number(m.cost?.input??m.cost?.inputPerMillion??0), output=Number(m.cost?.output??m.cost?.outputPerMillion??0);
    if(input===0&&output===0){console.log(C.green+"FREE"+C.reset+"  "+id+"  "+(m.name||""));n++}
  }
  if(!n)warn("No zero-cost OpenCode models found in current catalog");
}
async function request(prompt,history,c,session){
  const model=c.model.startsWith("opencode/")?c.model.slice(9):c.model;
  const h={"content-type":"application/json",accept:"application/json","user-agent":"giko-koko-cli/"+VERSION,"x-opencode-client":"giko-koko-cli","x-opencode-session":session};
  if(c.apiKey)h.authorization="Bearer "+c.apiKey;
  const r=await fetch(c.baseURL.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:h,body:JSON.stringify({model,messages:[{role:"system",content:"You are G.I KO KO Code, a concise coding agent. Explain actions briefly."},...history,{role:"user",content:prompt}],stream:false})});
  const t=await r.text(); if(!r.ok){let m=t;try{const j=JSON.parse(t);m=j.error?.message||j.message||t}catch{}throw new Error("HTTP "+r.status+": "+m)}
  return JSON.parse(t).choices?.[0]?.message?.content||"";
}
async function shell(s){const p=s.trim().split(/\s+/);if(!p[0])return "";const r=await exec(p[0],p.slice(1),{cwd:ROOT,maxBuffer:4*1024*1024});return(r.stdout||"")+(r.stderr||"")}
async function doctor(){const c=await cfg();console.log("G.I KO KO CODE doctor");console.log("Node: "+process.version+" / "+process.arch);console.log("Project: "+ROOT);console.log("Base URL: "+c.baseURL);console.log("Model: "+c.model);try{await fs.access(path.join(ROOT,".git"));ok("Git repository detected")}catch{warn("Not a Git repository")}try{await fetch(c.baseURL,{method:"HEAD"});ok("Provider endpoint reachable")}catch(e){warn(e.message)}}
async function interactive(){
  const c=await cfg(),history=[],session=sid();console.log(C.gold+"╭─ G.I KO KO CODE ─────────────────────────╮"+C.reset);console.log(C.gold+"│"+C.reset+" ARMv7 lightweight coding agent            "+C.gold+"│"+C.reset);console.log(C.gold+"╰───────────────────────────────────────────╯"+C.reset);
  console.log(C.dim+"Project: "+ROOT+"  Model: "+c.model+C.reset);const rl=readline.createInterface({input,output});
  while(true){const q=(await rl.question("\n> ")).trim();if(!q)continue;if(q==="/exit"||q==="/quit")break;
    if(q==="/models"){try{await listModels()}catch(e){fail(e.message)};continue} if(q==="/doctor"){await doctor();continue}
    if(q==="/clear"){history.length=0;ok("session cleared");continue} if(q.startsWith("/model ")){c.model=q.slice(7).trim();await save(c);ok("model = "+c.model);continue}
    if(q.startsWith("!")){try{console.log(await shell(q.slice(1)))}catch(e){fail(e.message)};continue}
    if(q.startsWith("@")){try{const f=path.resolve(ROOT,q.slice(1).trim()),t=await fs.readFile(f,"utf8");history.push({role:"user",content:"File "+f+" content:\n"+t});ok("attached "+f)}catch(e){fail(e.message)};continue}
    try{console.log(C.dim+"thinking…"+C.reset);const a=await request(q,history,c,session);history.push({role:"user",content:q},{role:"assistant",content:a});console.log(a)}
    catch(e){fail(e.message);warn("Free-tier access is enforced by the OpenCode server; this CLI does not bypass server restrictions.")}
  }rl.close();
}
async function main(){await ensure();const a=process.argv.slice(2),cmd=a[0];
  if(!cmd)return interactive(); if(cmd==="--version"||cmd==="version")return console.log("giko-koko "+VERSION);
  if(cmd==="models")return listModels(); if(cmd==="doctor")return doctor();
  if(cmd==="run"){const p=a.slice(1).join(" ");if(!p)throw Error("usage: giko run <prompt>");const c=await cfg();return console.log(await request(p,[],c,sid()))}
  if(cmd==="config"){const c=await cfg();c.apiKey=c.apiKey?"***":null;return console.log(JSON.stringify(c,null,2))}
  if(cmd==="set"){const k=a[1],v=a.slice(2).join(" "),c=await cfg();if(!["baseURL","model","apiKey"].includes(k))throw Error("supported: baseURL, model, apiKey");c[k]=v;await save(c);return ok(k+" updated")}
  if(cmd==="help")return console.log("giko | giko run <prompt> | giko models | giko doctor | giko config | giko set model <id>\nInteractive: /models /model <id> /doctor /clear /exit, @file, !shell");
  throw Error("unknown command: "+cmd);
}
main().catch(e=>{fail(e.message);process.exitCode=1});
