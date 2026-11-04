import {mkdirSync,writeFileSync} from 'node:fs';
import {queryIfind} from '../lib/research/ifind.ts';
const report=await queryIfind(process.env.IFIND_MCP_TOKEN);
mkdirSync('outputs',{recursive:true});writeFileSync('outputs/ifind-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,toolCount:report.tools.length,textLength:report.text.length,validation:report.validation?.status??'not-run',message:report.validation?.message??report.message}));
if(report.status!=='queried')process.exitCode=1;
else if(report.validation?.status!=='consistent')process.exitCode=2; // Transport worked, financial evidence still unresolved/conflicting.
