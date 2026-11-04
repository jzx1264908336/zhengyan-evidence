import data from './market.json' with {type:'json'};
export const marketData=data;
export type Point={date:string;close:string;open?:string;high?:string;low?:string};
export function alignedWindow(stock:Point[],benchmark:Point[],count:number){
 if(!Number.isInteger(count)||count<2)throw new Error('区间至少包含两个样本');
 for(const rows of [stock,benchmark]){if(rows.some((r,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Number(r.close))||Number(r.close)<=0||(i>0&&r.date<=rows[i-1].date)))throw new Error('行情日期或价格契约无效')}
 const map=new Map(benchmark.map(r=>[r.date,r]));const common=stock.filter(r=>map.has(r.date));const selected=common.slice(-count);
 if(selected.length<2)throw new Error('共同交易日不足');
 return {stock:selected,benchmark:selected.map(r=>map.get(r.date)!),excludedStock:stock.length-common.length,excludedBenchmark:benchmark.length-common.length};
}
export function pathStats(rows:Point[]){
 if(rows.length<2||rows.some(r=>!Number.isFinite(Number(r.close))||Number(r.close)<=0))throw new Error('价格序列不足或无效');
 let peak=rows[0],peakAtWorst=peak,trough=peak,worst=0;
 for(const row of rows){if(Number(row.close)>Number(peak.close))peak=row;const d=Number(row.close)/Number(peak.close)-1;if(d<worst){worst=d;peakAtWorst=peak;trough=row}}
 return {start:rows[0],end:rows.at(-1)!,returnValue:Number(rows.at(-1)!.close)/Number(rows[0].close)-1,drawdown:worst,peak:peakAtWorst,trough};
}
export function marketWindow(count=244){const rows=alignedWindow(data.stock,data.benchmark,count);return {...rows,stockStats:pathStats(rows.stock),benchmarkStats:pathStats(rows.benchmark)}}
export function nextSession(disclosureDate:string,rows:Point[]){return rows.find(r=>r.date>disclosureDate)?.date??null;}
