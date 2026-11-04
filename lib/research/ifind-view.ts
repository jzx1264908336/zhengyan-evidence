// Display only explicitly requested annual columns; preserve provider strings and units.
export function ifindFinanceTable(text:string){
 const lines=text.split('\n').filter(l=>l.trim().startsWith('|'));if(lines.length<3)return null;
 const cells=(line:string)=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
 const headers=cells(lines[0]);const wanted=['证券代码','日期','营业收入（单位：元）','归属于母公司所有者的净利润（单位：元）','经营活动产生的现金流量净额（单位：元）'];
 const indexes=wanted.map(h=>headers.indexOf(h));if(indexes.some(i=>i<0))return null;
 const rows=lines.slice(2).map(cells).filter(r=>r.length===headers.length).map(r=>indexes.map(i=>r[i]));
 return rows.length?{headers:wanted,rows}:null;
}
