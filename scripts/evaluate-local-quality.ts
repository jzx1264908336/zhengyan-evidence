import {mkdirSync,writeFileSync} from 'node:fs';
import {interpret,PROMPT_VERSION} from '../lib/research/ai.ts';
const tune=process.argv.includes('--tune');
const critical=['合并经营现金流和归母净利润能直接作比较吗？','茅台的估值是否合理，使用什么口径？','综合经营、估值和行情，哪些结论有证据、哪些没有？'];
const heldout=['合并现金流除以归母利润，口径对齐了吗？','我能把归属于母公司股东的利润当成合并净利润吗？','五粮液调了收入确认，应该怎么和其他酒企比较？','先看估值，再看股价，最后看经营；每项分别说证据和未知。','股价跑赢了指数，是否由公告造成？','年报下滑但前三季改善，可以推断全年反转吗？','有哪些能立刻打开原文验证的下一步动作？','PB权益时点滞后为什么重要？'];
const profiles=tune?[{temperature:0,thinking:false},{temperature:0.2,thinking:false}]:[{temperature:0,thinking:false}];
const records=[];
for(const profile of profiles)for(const question of tune?critical:heldout){const start=Date.now();const result=await interpret(question,false,{provider:'ollama',...profile});records.push({profile,question,elapsedMs:Date.now()-start,result});console.log(JSON.stringify({case:records.length,profile,status:result.status,claims:result.claims.length}));}
mkdirSync('outputs',{recursive:true});
writeFileSync(`outputs/local-${tune?'tuning':'heldout'}.json`,JSON.stringify({prompt:PROMPT_VERSION,generatedAt:new Date().toISOString(),weightsChanged:false,semanticReview:'pending',records},null,2));
if(records.some(r=>r.result.status!=='verified'))process.exitCode=1;
