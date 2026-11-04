// Local-only launcher. Does not read, overwrite, or transmit a cloud API key.
import {existsSync,readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
// Import only the separately authorized finance key; cloud model credentials stay unused.
if(existsSync('.env')){const privateEnv=parseEnv(readFileSync('.env','utf8'));for(const name of ['HITHINK_FINANCE_API_KEY','IFIND_MCP_TOKEN'])if(privateEnv[name]&&!process.env[name])process.env[name]=privateEnv[name];}
async function models(){try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(1500)});return r.ok?(await r.json()).models:null}catch{return null}}
let installed=await models();
if(!installed&&process.platform==='win32'){
 const binary=join(process.env.LOCALAPPDATA??'','Programs','Ollama','ollama.exe');
 if(existsSync(binary)){
  console.log('Starting installed Ollama locally...');
  const service=spawn(binary,['serve'],{detached:true,stdio:'ignore',windowsHide:true});service.on('error',()=>{});service.unref();
  for(let i=0;i<15&&!installed;i++){await new Promise(resolve=>setTimeout(resolve,500));installed=await models()}
 }
}
if(!installed)throw new Error('Ollama 未启动，请打开 Ollama 后重试。');
if(!installed.some(model=>model.name==='qwen3.5:9b'))throw new Error('请先通过 Ollama 下载 qwen3.5:9b 模型。');
process.env.MODEL_PROVIDER='ollama';
process.env.MODEL_ENDPOINT='http://127.0.0.1:11434/api/chat';
process.env.MODEL_NAME='qwen3.5:9b';
delete process.env.MODEL_API_KEY;
delete process.env.OPENAI_API_KEY;
const command=process.argv[2]??'dev';
if(command==='verify')await import('./verify-model.ts');
else if(command==='dev'){
 process.argv=[process.execPath,process.argv[1],'dev'];
 await import('./run-framework.mjs');
}else throw new Error('Expected dev or verify');
