#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {randomUUID} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const exec=promisify(execFile), VERSION="0.2.0", ROOT=process.cwd();
const HOME=os.homedir(), DIR=path.join(HOME,".config","gcode-koko");
const CFG=path.join(DIR,"config.json"), SESS=path.join(DIR,"sessions");
const DEFAULT_BASE=process.env.GCODE_BASE_URL||"https://ai-gateway.kilo.ai/api/v1";
const DEFAULT_MODEL=process.env.GCODE_MODEL||"kilo-auto/free";
const C={gold:"\x1b[38;5;220m",green:"\x1b[38;5;114m",red:"\x1b[38;5;203m",blue:"\x1b[38;5;117m",dim:"\x1b[2m",reset:"\x1b[0m",bold:"\x1b[1m"};
const paint=(s,c)=>c+s+C.reset, ok=s=>console.log(paint("✓ "+s,C.green)), fail=s=>console.log(paint("✗ "+s,C.red)), warn=s=>console.log(paint("! "+s,C.gold));
const defaults={baseURL:DEFAULT_BASE,model:DEFAULT_MODEL,apiKey:null,mode:"ask",theme:"gold",features:{fileRead:true,fileWrite:true,shell:true,git:true,skills:true,plan:true,memory:true,subagents:true,mcp:true,plugins:true,lsp:true,hooks:true},permissions:{read:"allow",write:"ask",shell:"ask"},maxToolRounds:12};
async function ensure(){await fs.mkdir(DIR,{recursive:true});await fs.mkdir(SESS,{recursive:true});try{await fs.access(CFG)}catch{await fs.writeFile(CFG,JSON.stringify(defaults,null,2)+"\n")}}
async function cfg(){await ensure();let old={};try{old=JSON.parse(await fs.readFile(CFG,"utf8"))}catch{};return {...defaults,...old,features:{...defaults.features,...(old.features||{})},permissions:{...defaults.permissions,...(old.permissions||{})}}}
async function save(c){await fs.mkdir(DIR,{recursive:true});await fs.writeFile(CFG,JSON.stringify(c,null,2)+"\n",{mode:0o600})}
const sid=()=> "ses_"+randomUUID().replaceAll("-","").slice(0,26);
const safePath=p=>{const f=path.resolve(ROOT,p||".");if(f!==ROOT&&!f.startsWith(ROOT+path.sep))throw Error("Path is outside project directory");return f};
async function ask(rl,q){return (await rl.question(q)).trim()}
async function approve(rl,c,kind,detail){
  const policy=c.permissions?.[kind]||"ask";
  if(policy==="allow"||c.mode==="auto")return true;
  if(policy==="deny")return false;
  const a=(await ask(rl,paint("Allow "+kind+"? "+detail+" [y/N] ",C.gold))).toLowerCase();
  return a==="y"||a==="yes";
}
async function readFile(p){const f=safePath(p);const s=await fs.readFile(f,"utf8");return s.length>60000?s.slice(0,60000)+"\n[truncated]":s}
async function listFiles(p="."){const f=safePath(p);const out=[];async function walk(d,depth){if(depth>4||out.length>250)return;for(const e of await fs.readdir(d,{withFileTypes:true})){if([".git","node_modules",".next","dist","build"].includes(e.name))continue;const x=path.join(d,e.name);out.push(path.relative(ROOT,x)+(e.isDirectory()?"/":""));if(e.isDirectory())await walk(x,depth+1)}}await walk(f,0);return out.join("\n")}
async function searchText(q){const files=(await listFiles(".")).split("\n").filter(x=>x&&!x.endsWith("/")).slice(0,180);const hits=[];for(const p of files){try{const lines=(await fs.readFile(safePath(p),"utf8")).split("\n");for(let i=0;i<lines.length;i++)if(lines[i].toLowerCase().includes(q.toLowerCase()))hits.push(p+":"+(i+1)+": "+lines[i].slice(0,240));}catch{}if(hits.length>=80)break}return hits.join("\n")||"No matches"}
async function executeTool(name,args,rl,c){
  const p=args.path||".";
  if(name==="read_file"){if(!c.features.fileRead)throw Error("File reading disabled in /settings");return await readFile(p)}
  if(name==="list_files"){if(!c.features.fileRead)throw Error("File access disabled");return await listFiles(p)}
  if(name==="search_text"){if(!c.features.fileRead)throw Error("File access disabled");return await searchText(args.query||"")}
  if(name==="write_file"){
    if(!c.features.fileWrite)throw Error("File writing disabled in /settings");
    const f=safePath(p);if(!await approve(rl,c,"write","write "+path.relative(ROOT,f)))return "DENIED by user";
    await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,String(args.content??""),"utf8");return "Wrote "+path.relative(ROOT,f)
  }
  if(name==="edit_file"){
    if(!c.features.fileWrite)throw Error("File editing disabled in /settings");
    const f=safePath(p);if(!await approve(rl,c,"write","edit "+path.relative(ROOT,f)))return "DENIED by user";
    const old=await fs.readFile(f,"utf8"),needle=String(args.old_text??"");if(!needle)throw Error("old_text cannot be empty");
    if(!old.includes(needle))return "EDIT FAILED: exact old_text not found";
    const next=old.replace(needle,String(args.new_text??""));await fs.writeFile(f,next,"utf8");return "Edited "+path.relative(ROOT,f)
  }
  if(name==="run_command"){
    if(!c.features.shell)throw Error("Shell execution disabled in /settings");
    const command=String(args.command||"");if(!command)throw Error("command required");
    if(!await approve(rl,c,"shell",command))return "DENIED by user";
    try{const r=await exec("sh",["-lc",command],{cwd:ROOT,maxBuffer:2*1024*1024,timeout:120000});return ((r.stdout||"")+(r.stderr||"")).slice(0,30000)||"Command completed"}
    catch(e){return "EXIT "+(e.code??"?")+"\n"+String(e.stdout||"")+String(e.stderr||e.message).slice(0,30000)}
  }
  if(name==="git_status"){if(!c.features.git)throw Error("Git tools disabled");try{const r=await exec("git",["status","--short","--branch"],{cwd:ROOT,maxBuffer:500000});return r.stdout||"Clean working tree"}catch(e){return e.message}}
  if(name==="git_diff"){if(!c.features.git)throw Error("Git tools disabled");try{const r=await exec("git",["diff","--"],{cwd:ROOT,maxBuffer:1000000});return r.stdout.slice(0,30000)||"No unstaged diff"}catch(e){return e.message}}
  throw Error("Unknown tool "+name)
}
const tools=[
{name:"read_file",description:"Read a UTF-8 file inside the current project.",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}},
{name:"list_files",description:"List project files. Skips dependency and build directories.",parameters:{type:"object",properties:{path:{type:"string"}}}},
{name:"search_text",description:"Search project text files for a literal phrase.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}},
{name:"write_file",description:"Create or replace a project file. User approval is required unless permissions allow it.",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"]}},
{name:"edit_file",description:"Replace one exact text occurrence in an existing project file.",parameters:{type:"object",properties:{path:{type:"string"},old_text:{type:"string"},new_text:{type:"string"}},required:["path","old_text","new_text"]}},
{name:"run_command",description:"Run a shell command in the project directory. User approval is required unless permissions allow it.",parameters:{type:"object",properties:{command:{type:"string"}},required:["command"]}},
{name:"git_status",description:"Show current Git status.",parameters:{type:"object",properties:{}}},
{name:"git_diff",description:"Show unstaged Git diff.",parameters:{type:"object",properties:{}}}
];
function systemPrompt(c){return "You are G.I KO KO Code, a careful Claude-Code-style terminal coding agent. Project root: "+ROOT+". Model: "+c.model+". Mode: "+c.mode+". You may inspect and modify project files only through provided tools. Never claim an action succeeded unless its tool result confirms it. Before broad changes inspect files. Preserve existing behavior and user configuration. Prefer minimal targeted patches, explain important changes, run relevant tests after edits. Ask before destructive operations. If tools are unavailable, say so plainly. For plans, be concrete and ordered. Do not expose secrets."}
async function request(messages,c,session,withTools=true){
  const base=c.baseURL.replace(/\/$/,""),headers={"content-type":"application/json",accept:"application/json","user-agent":"gcode-koko-cli/"+VERSION,"x-opencode-client":"gcode-koko-cli","x-opencode-session":session};
  if(c.apiKey)headers.authorization="Bearer "+c.apiKey;
  const body={model:c.model,messages,stream:false};
  if(withTools)body.tools=tools.map(t=>({type:"function",function:t}));
  const r=await fetch(base+"/chat/completions",{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const t=await r.text();if(!r.ok){let m=t;try{const j=JSON.parse(t);m=j.error?.message||j.message||t}catch{}throw Error("HTTP "+r.status+": "+m)}
  return JSON.parse(t).choices?.[0]?.message||{content:t}
}
async function agent(prompt,history,c,rl,session){
  const messages=[{role:"system",content:systemPrompt(c)},...history,{role:"user",content:prompt}];
  for(let round=0;round<(c.maxToolRounds||12);round++){
    const m=await request(messages,c,session,c.mode!=="plan");
    if(!m.tool_calls?.length){const answer=m.content||"(No text response)";history.push({role:"user",content:prompt},{role:"assistant",content:answer});return answer}
    messages.push(m);
    for(const call of m.tool_calls){
      let args={};try{args=JSON.parse(call.function.arguments||"{}")}catch{}
      console.log(paint("  ↳ "+call.function.name+" "+JSON.stringify(args),C.dim));
      let result;try{result=await executeTool(call.function.name,args,rl,c)}catch(e){result="TOOL ERROR: "+e.message}
      messages.push({role:"tool",tool_call_id:call.id,name:call.function.name,content:String(result).slice(0,30000)});
    }
  }
  throw Error("Agent reached the maximum tool-call rounds ("+(c.maxToolRounds||12)+"). Ask it to continue.")
}
async function fetchModels(c){
  const base=c.baseURL.replace(/\/$/,"");
  const headers={accept:"application/json","user-agent":"gcode-koko-cli/"+VERSION};
  if(c.apiKey)headers.authorization="Bearer "+c.apiKey;
  const r=await fetch(base+"/models",{headers,signal:AbortSignal.timeout(20000)});
  const body=await r.text();
  if(!r.ok)throw Error("Models API HTTP "+r.status+": "+body.slice(0,500));
  const data=JSON.parse(body);
  const rows=Array.isArray(data)?data:(data.data||data.models||[]);
  return rows.map(x=>({id:String(x.id||x.name||""),free:x.pricing?Number(x.pricing.prompt||0)===0&&Number(x.pricing.completion||0)===0:(x.cost?Number(x.cost.input||0)===0&&Number(x.cost.output||0)===0:/free/i.test(String(x.id||"")))})).filter(x=>x.id);
}
async function chooseModel(rl,c){
  try{
    console.log(paint("Fetching models from "+c.baseURL+" ...",C.dim));
    const models=await fetchModels(c);
    if(!models.length){warn("Provider returned no model entries.");const id=await ask(rl,"Model ID: ");if(id){c.model=id;await save(c);ok("Model set to "+id)}return}
    console.log("\n"+paint("AVAILABLE MODELS",C.gold));
    models.forEach((m,i)=>console.log((i+1)+". "+m.id+(m.free?"  "+paint("[FREE]",C.green):"")));
    console.log("f. Show free models only   m. Enter model ID manually   0. Cancel");
    let list=models;
    while(true){
      const v=await ask(rl,paint("Choose model: ",C.gold));
      if(v==="0"||!v)return;
      if(v==="f"){list=models.filter(x=>x.free);if(!list.length){warn("Provider did not identify free models.");continue}list.forEach((m,i)=>console.log((i+1)+". "+m.id+"  "+paint("[FREE]",C.green)));continue}
      if(v==="m"){const id=await ask(rl,"Model ID: ");if(id){c.model=id;await save(c);ok("Model set to "+id)}return}
      if(/^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=list.length){c.model=list[Number(v)-1].id;await save(c);ok("Model set to "+c.model);return}
      warn("Choose a listed number, f, m or 0");
    }
  }catch(e){warn("Could not load provider model list: "+e.message);const id=await ask(rl,"Enter model ID manually (blank to cancel): ");if(id){c.model=id;await save(c);ok("Model set to "+id)}}
}
async function showModels(rl,c){
  try{const models=await fetchModels(c);if(!models.length){warn("No models returned");return}
    console.log(paint("AVAILABLE MODELS",C.gold));
    models.forEach((m,i)=>console.log((i+1)+". "+m.id+(m.free?"  "+paint("[FREE]",C.green):"")));
    console.log("\nCurrent: "+c.model+"\nUse /model <number> to select, or /model <id> to set manually.");
  }catch(e){fail("Model list unavailable: "+e.message);console.log("Current model: "+c.model)}
}
async function doctor(){const c=await cfg();console.log("G.I KO KO CODE "+VERSION);console.log("Node: "+process.version+" / "+process.arch);console.log("Project: "+ROOT);console.log("Provider: "+c.baseURL);console.log("Model: "+c.model);console.log("Mode: "+c.mode);try{await fs.access(path.join(ROOT,".git"));ok("Git repository detected")}catch{warn("Not a Git repository")}try{const r=await fetch(c.baseURL,{method:"HEAD",signal:AbortSignal.timeout(10000)});ok("Provider host reachable (HTTP "+r.status+")")}catch(e){warn("Provider check: "+e.message)}}
const featureLabels={fileRead:"Read project files",fileWrite:"Write/edit project files",shell:"Run shell commands",git:"Git tools",skills:"Load project Skills",plan:"Plan mode",memory:"Persistent session history",subagents:"Subagent profiles",mcp:"MCP configuration",plugins:"Plugin configuration",lsp:"LSP configuration",hooks:"Hooks"};
async function settings(rl,c){
  const keys=Object.keys(featureLabels);
  while(true){
    console.log("\n"+paint("⚙ GCODE SETTINGS",C.gold)+"  [save automatically]");
    console.log("Provider: "+c.baseURL+"\nModel: "+c.model+"\nMode: "+c.mode);
    keys.forEach((k,i)=>console.log((i+1)+". "+(c.features[k]?"[ON ]":"[OFF]")+" "+featureLabels[k]));
    console.log("p. Change provider URL   m. Change model   a. API key   x. Permission mode   t. Theme   0. Back");
    const v=await ask(rl,paint("Select: ",C.gold));if(v==="0"||!v)break;
    if(/^[1-9]\d*$/.test(v)&&Number(v)<=keys.length){const k=keys[Number(v)-1];c.features[k]=!c.features[k];await save(c);ok(featureLabels[k]+" "+(c.features[k]?"enabled":"disabled"));continue}
    if(v==="p"){c.baseURL=await ask(rl,"Base URL: ");await save(c);continue}
    if(v==="m"){await chooseModel(rl,c);continue}
    if(v==="a"){const k=await ask(rl,"API key (blank keeps current): ");if(k)c.apiKey=k;await save(c);ok("API key saved");continue}
    if(v==="x"){console.log("1. ask (confirm writes/shell)\n2. auto (allow tools)\n3. plan (no tools)");const n=await ask(rl,"Mode: ");c.mode=({"1":"ask","2":"auto","3":"plan"})[n]||c.mode;await save(c);continue}
    if(v==="t"){c.theme=await ask(rl,"Theme name (gold/green/blue): ")||"gold";await save(c);continue}
    warn("Unknown selection");
  }
}
async function loadSkills(c){if(!c.features.skills)return "Skills are disabled";const root=path.join(ROOT,".gcode","skills");let out=[];try{for(const name of await fs.readdir(root)){const f=path.join(root,name,"SKILL.md");try{out.push("### "+name+"\n"+(await fs.readFile(f,"utf8")).slice(0,12000))}catch{}}}catch{}return out.join("\n\n")||"No project skills found. Create .gcode/skills/<skill-name>/SKILL.md"}
async function showSkills(c){console.log(await loadSkills(c))}
async function saveSession(session,history){const f=path.join(SESS,session+".json");await fs.writeFile(f,JSON.stringify({session,updatedAt:new Date().toISOString(),cwd:ROOT,history:history.slice(-100)},null,2)+"\n",{mode:0o600})}
async function resumeSession(id){const f=path.join(SESS,id+".json");const d=JSON.parse(await fs.readFile(f,"utf8"));return d}
async function interactive(){
  const c=await cfg(),rl=readline.createInterface({input,output}),history=[];let session=sid();
  console.log(paint("╭─ ✦ G.I KO KO CODE "+VERSION+" ─────────────────────╮",C.gold));
  console.log(paint("│",C.gold)+" Claude Code-style Agent • ARMv7 / Termux      "+paint("│",C.gold));
  console.log(paint("╰────────────────────────────────────────────────╯",C.gold));
  console.log(paint("Project: "+ROOT+"  Model: "+c.model+"  Mode: "+c.mode,C.dim));
  console.log(paint("Type /help for commands • /settings to configure • /exit to quit",C.dim));
  while(true){
    let q;try{q=await ask(rl,paint("\n❯ ",C.green))}catch{break}if(!q)continue;
    if(q==="/exit"||q==="/quit")break;
    if(q==="/help"){console.log("/settings /model <id> /models /doctor /plan <task> /auto /ask /skills /agents /mcp /plugins /hooks /status /context /compact /clear /resume <session-id> /exit\nUse @path to attach a file. Use !command to run a shell command.");continue}
    if(q==="/settings"){await settings(rl,c);continue}
    if(q==="/models"){await showModels(rl,c);continue}
    if(q.startsWith("/model ")){const value=q.slice(7).trim();if(/^\d+$/.test(value)){try{const models=await fetchModels(c);const item=models[Number(value)-1];if(!item){warn("Model number not found. Use /models");continue}c.model=item.id}catch(e){fail(e.message);continue}}else c.model=value;await save(c);ok("Model changed to "+c.model);continue}
    if(q==="/doctor"){await doctor();continue}
    if(q==="/plan"){c.mode="plan";await save(c);ok("Plan mode enabled (tools disabled)");continue}
    if(q.startsWith("/plan ")){const old=c.mode;c.mode="plan";try{console.log(paint("✦ PLAN",C.gold)+"\n"+await agent(q.slice(6),history,c,rl,session))}catch(e){fail(e.message)}c.mode=old;continue}
    if(q==="/auto"){c.mode="auto";await save(c);ok("Auto mode enabled. Tool calls will run without confirmation.");continue}
    if(q==="/ask"){c.mode="ask";await save(c);ok("Ask mode enabled. Writes and shell commands require approval.");continue}
    if(q==="/skills"){await showSkills(c);continue}
    if(q==="/agents"){console.log("Built-in agent profiles: coder, reviewer, tester, planner. Use /agent <profile> <task>.");continue}
    if(q.startsWith("/agent ")){const parts=q.split(/\s+/),role=parts[1],task=q.slice(7+role.length).trim();const profiles={coder:"Focus on implementing maintainable code.",reviewer:"Review for bugs, security, regressions and missing tests. Do not edit unless asked.",tester:"Focus on test design and running tests.",planner:"Only analyze and produce an implementation plan."};if(!profiles[role]){warn("Profiles: coder, reviewer, tester, planner");continue}try{console.log(await agent(profiles[role]+"\n"+task,history,c,rl,session))}catch(e){fail(e.message)}continue}
    if(q==="/mcp"||q==="/plugins"||q==="/hooks"){const k=q.slice(1);console.log(k+" configuration is stored in config.json. Native protocol/runtime integration is not enabled in this lightweight ARMv7 build yet.");continue}
    if(q==="/status"){console.log("Session: "+session+"\nModel: "+c.model+"\nMode: "+c.mode+"\nHistory messages: "+history.length+"\nFeatures: "+Object.entries(c.features).filter(x=>x[1]).map(x=>x[0]).join(", "));continue}
    if(q==="/context"){console.log("Project: "+ROOT+"\nRecent conversation messages: "+history.length+"\nSession: "+session);continue}
    if(q==="/compact"){if(history.length>8)history.splice(0,history.length-8);ok("Kept the last 8 conversation messages");continue}
    if(q==="/clear"){history.length=0;session=sid();ok("New session started");continue}
    if(q.startsWith("/resume ")){try{const d=await resumeSession(q.slice(8).trim());history.splice(0,history.length,...d.history);session=d.session;ok("Resumed "+session)}catch(e){fail(e.message)}continue}
    if(q.startsWith("@")){try{const p=q.slice(1).trim(),s=await readFile(p);history.push({role:"user",content:"Attached file "+p+":\n"+s});ok("Attached "+p)}catch(e){fail(e.message)}continue}
    if(q.startsWith("!")){try{const result=await executeTool("run_command",{command:q.slice(1)},rl,c);console.log(result)}catch(e){fail(e.message)}continue}
    try{
      console.log(paint("✦ GCODE · thinking",C.gold));
      const skills=await loadSkills(c);const prompt=(c.features.skills&&skills!=="No project skills found. Create .gcode/skills/<skill-name>/SKILL.md"?"Project skills:\n"+skills+"\n\n":"")+q;
      const answer=await agent(prompt,history,c,rl,session);
      console.log("\n"+paint("✦ GCODE",C.gold)+"\n"+answer);
      if(c.features.memory)await saveSession(session,history);
    }catch(e){fail(e.message);if(String(e.message).includes("HTTP 429"))warn("Provider rate limit reached. Your saved provider/model settings were preserved.");}
  }
  rl.close();
}
async function main(){
  await ensure();const a=process.argv.slice(2),cmd=a[0],c=await cfg();
  if(!cmd)return interactive();
  if(cmd==="--version"||cmd==="version")return console.log("gcode-koko "+VERSION);
  if(cmd==="doctor")return doctor();
  if(cmd==="config"){const x={...c,apiKey:c.apiKey?"***":null};return console.log(JSON.stringify(x,null,2))}
  if(cmd==="set"){const k=a[1],v=a.slice(2).join(" ");if(!["baseURL","model","apiKey"].includes(k))throw Error("supported: baseURL, model, apiKey");c[k]=v;await save(c);return ok(k+" updated")}
  if(cmd==="run"){const p=a.slice(1).join(" ");if(!p)throw Error("usage: gcode run <task>");const rl=readline.createInterface({input,output});try{console.log(await agent(p,[],c,rl,sid()))}finally{rl.close()}return}
  if(cmd==="settings"){const rl=readline.createInterface({input,output});try{await settings(rl,c)}finally{rl.close()}return}
  if(cmd==="help")return console.log("gcode | gcode run <task> | gcode settings | gcode doctor | gcode config | gcode set <baseURL|model|apiKey> <value>\nInteractive: /settings /plan /auto /ask /skills /agent /status /resume /model /doctor /clear /exit");
  throw Error("unknown command: "+cmd);
}
main().catch(e=>{fail(e.message);process.exitCode=1});
