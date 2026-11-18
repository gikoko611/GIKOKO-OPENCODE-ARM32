#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {randomUUID} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const exec=promisify(execFile);
const VERSION="0.1.0";
const ROOT=process.cwd();
const CFG=path.join(os.homedir(),".config","giko-koko","config.json");
const DEFAULT_BASE=process.env.GIKO_BASE_URL||"https://opencode.ai/inference/openai/v1";
const DEFAULT_MODEL=process.env.GIKO_MODEL||"opencode/glm-5.3-flash-free";
const gold="\\x1b[38;5;220m",green="\\x1b[38;5;114m",red="\\x1b[38;5;203m",dim="\\x1b[2m",reset="\\x1b[0m";
const ok=s=>console.log(green+"✓ "+s+reset);
const warn=s=>console.log(gold+"! "+s+reset);
const fail=s=>console.log(red+"✗ "+s+reset);

async function ensure(){
  try{await fs.access(CFG)}catch{
    await fs.mkdir(path.dirname(CFG),{recursive:true});
    await fs.writeFile(CFG,JSON.stringify({baseURL:DEFAULT_BASE,model:DEFAULT_MODEL,apiKey:null},null,2)+"\\n");
  }
}
async function cfg(){await ensure();return JSON.parse(await fs.readFile(CFG,"utf8"))}
async function save(c){await fs.writeFile(CFG,JSON.stringify(c,null,2)+"\\n")}
function sid(){return "ses_"+randomUUID().replaceAll("-","").slice(0,26)}

async function listModels(){
  const r=await fetch("https://models.dev/api.json");
  if(!r.ok)throw new Error("models.dev HTTP "+r.status);
  const d=await r.json(),p=d.opencode;
  if(!p||!p.models)throw new Error("OpenCode provider not found");
  for(const [id,m] of Object.entries(p.models))
    if(Number(m.cost?.input??0)===0)console.log(green+"FREE"+reset+"  "+id+"  "+(m.name||""));
}

async function request(prompt,history,c,session){
  const model=c.model.includes("/")?c.model.split("/").slice(1).join("/"):c.model;
  const headers={"content-type":"application/json","accept":"application/json","user-agent":"giko-koko-cli/"+VERSION,"x-opencode-client":"giko-koko-cli","x-opencode-session":session};
  if(c.apiKey)headers.authorization="Bearer "+c.apiKey;
  const body={model:model,messages:[{role:"system",content:"You are G.I KO KO Code, a concise coding agent. Explain actions briefly."},...history,{role:"user",content:prompt}],stream:false};
  const r=await fetch(c.baseURL.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers,body:JSON.stringify(body)});
  const text=await r.text();
  if(!r.ok){
    let msg=text;
    try{const j=JSON.parse(text);msg=j.error?.message||j.message||text}catch{}
    throw new Error("HTTP "+r.status+": "+msg);
  }
  const j=JSON.parse(text);
  return j.choices?.[0]?.message?.content||"";
}

async function shell(command){
  const p=command.trim().split(/\s+/);
  if(!p[0])return "";
  const r=await exec(p[0],p.slice(1),{cwd:ROOT,maxBuffer:4*1024*1024});
  return (r.stdout||"")+(r.stderr||"");
}
async function doctor(){
  const c=await cfg();
  console.log("G.I KO KO CODE doctor");
  console.log("Node: "+process.version+" / "+process.arch+" / "+process.platform);
  console.log("Project: "+ROOT);
  console.log("Base URL: "+c.baseURL);
  console.log("Model: "+c.model);
  try{await fs.access(path.join(ROOT,".git"));ok("Git repository detected")}catch{warn("Not a Git repository")}
  try{await fetch(c.baseURL,{method:"HEAD"});ok("Provider endpoint reachable")}catch(e){warn("Provider endpoint: "+e.message)}
}

async function interactive(){
  const c=await cfg(),session=sid(),history=[];
  console.log(gold+"╭─ G.I KO KO CODE ─────────────────────────╮"+reset);
  console.log(gold+"│"+reset+" ARMv7 lightweight coding agent            "+gold+"│"+reset);
  console.log(gold+"╰───────────────────────────────────────────╯"+reset);
  console.log(dim+"Project: "+ROOT+"  Model: "+c.model+reset);
  const rl=readline.createInterface({input,output});
  while(true){
    const q=(await rl.question("\n> ")).trim();
    if(!q)continue;
    if(q==="/exit"||q==="/quit")break;
    if(q==="/models"){try{await listModels()}catch(e){fail(e.message)};continue}
    if(q==="/doctor"){await doctor();continue}
    if(q==="/clear"){history.length=0;ok("session cleared");continue}
    if(q.startsWith("/model ")){c.model=q.slice(7).trim();await save(c);ok("model = "+c.model);continue}
    if(q.startsWith("!")){try{console.log(await shell(q.slice(1)))}catch(e){fail(e.message)};continue}
    if(q.startsWith("@")){
      const f=path.resolve(ROOT,q.slice(1).trim());
      try{const t=await fs.readFile(f,"utf8");history.push({role:"user",content:"File "+f+" content:\n"+t});ok("attached "+f)}catch(e){fail(e.message)}
      continue;
    }
    try{
      console.log(dim+"thinking…"+reset);
      const answer=await request(q,history,c,session);
      history.push({role:"user",content:q},{role:"assistant",content:answer});
      console.log(answer);
    }catch(e){
      fail(e.message);
      warn("No account is stored by this CLI. OpenCode's hosted free tier may still enforce its client policy; this project does not bypass that server-side gate.");
    }
  }
  rl.close();
}

async function main(){
  await ensure();
  const a=process.argv.slice(2),cmd=a[0];
  if(!cmd){await interactive();return}
  if(cmd==="--version"||cmd==="version"){console.log("giko-koko "+VERSION);return}
  if(cmd==="models"){await listModels();return}
  if(cmd==="doctor"){await doctor();return}
  if(cmd==="run"){
    const p=a.slice(1).join(" ");
    if(!p)throw new Error("usage: giko run <prompt>");
    const c=await cfg();
    console.log(await request(p,[],c,sid()));
    return;
  }
  if(cmd==="config"){const c=await cfg();c.apiKey=c.apiKey?"***":null;console.log(JSON.stringify(c,null,2));return}
  if(cmd==="set"){
    const k=a[1],v=a.slice(2).join(" "),c=await cfg();
    if(!["baseURL","model","apiKey"].includes(k))throw new Error("supported: baseURL, model, apiKey");
    c[k]=v;await save(c);ok(k+" updated");return;
  }
  if(cmd==="help"){console.log("giko\ngiko run <prompt>\ngiko models\ngiko doctor\ngiko config\ngiko set baseURL <url>\ngiko set model <provider/model>\nInteractive: /models /model <id> /doctor /clear /exit, @file, !shell");return}
  throw new Error("unknown command: "+cmd);
}
main().catch(e=>{fail(e.message);process.exitCode=1});
