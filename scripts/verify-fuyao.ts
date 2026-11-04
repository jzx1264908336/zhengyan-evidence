// Run explicitly with --env-file=.env; never log credentials or raw provider errors.
import {mkdirSync,writeFileSync} from 'node:fs';
import {verifyFuyao} from '../lib/research/fuyao.ts';
const report=await verifyFuyao(process.env.HITHINK_FINANCE_API_KEY);
mkdirSync('outputs',{recursive:true});writeFileSync('outputs/fuyao-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,checks:report.checks.length,comparisons:report.checks.flatMap(c=>c.comparisons).length,message:report.message}));
if(report.status!=='verified')process.exitCode=1;
