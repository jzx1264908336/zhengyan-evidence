// Exports only the locked model cache, never Ollama account/config/key files.
import {readFileSync,existsSync,mkdirSync,readdirSync,copyFileSync,createReadStream,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(readFileSync(join(root,'models/model-lock.json'),'utf8'));
const source=process.env.OLLAMA_MODELS||join(homedir(),'.ollama','models');
const target=resolve(root,'outputs/offline-model');
const hash=async path=>{const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex')};
const manifestPath=join(source,'manifests',lock.manifestPath);
if(!existsSync(manifestPath))throw Error('未找到锁定模型的本地 manifest。');
if(await hash(manifestPath)!==lock.manifestSha256)throw Error('本机模型版本与锁定版本不同，请核实后再导出，未复制任何文件。');
for(const blob of lock.blobs){if(!/^sha256:[a-f0-9]{64}$/.test(blob.digest))throw Error('不合法的模型摘要');if(!existsSync(join(source,'blobs',blob.digest.replace(':','-'))))throw Error('本机模型组件不完整：'+blob.digest)}
console.log(JSON.stringify({model:lock.name,bytes:lock.totalBytes,componentCount:lock.blobs.length,target,weightsModified:false}));
if(!process.argv.includes('--export')){console.log('检查完成；真正导出请添加 --export，预计复制约6.6GB，不适合30MB附件。');process.exit(0)}
if(existsSync(target)&&readdirSync(target).length)throw Error('导出目录非空，停止以避免覆盖。请另行保存已有导出目录。');
mkdirSync(join(target,'ollama-models','blobs'),{recursive:true});
for(const blob of lock.blobs){const name=blob.digest.replace(':','-');const path=join(source,'blobs',name);if(await hash(path)!==blob.digest.slice(7))throw Error('模型组件摘要不符：'+name);copyFileSync(path,join(target,'ollama-models','blobs',name))}
const manifestTarget=join(target,'ollama-models','manifests',lock.manifestPath);mkdirSync(resolve(manifestTarget,'..'),{recursive:true});copyFileSync(manifestPath,manifestTarget);
copyFileSync(join(root,'models/QWEN-LICENSE.txt'),join(target,'QWEN-LICENSE.txt'));copyFileSync(join(root,'models/model-lock.json'),join(target,'model-lock.json'));
writeFileSync(join(target,'NOTICE.txt'),'Qwen3.5 9B, Copyright 2026 Alibaba Cloud. Apache-2.0. Model weights unchanged. Exported model-cache files only; no user account or API credentials included.\n');
console.log('离线模型组件已导出。仍需兼容的Ollama运行时；不要将整个 .ollama 个人配置目录打包。');
