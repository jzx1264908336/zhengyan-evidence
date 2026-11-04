"""Create supplemental snapshots from locally downloaded public source files.
This does not fetch data or silently change the baseline filing snapshot.
"""
from pathlib import Path
from decimal import Decimal
import json,re,hashlib,sys,datetime
from pypdf import PdfReader

root=Path(sys.argv[1] if len(sys.argv)>1 else '../research')
dest=Path(__file__).resolve().parents[1]/'lib/research'
observations=[]; sources=[]
calendar_url='https://www.sse.com.cn/disclosure/announcement/general/c/c_20251222_10802507.shtml'
closures=[('2026-01-01','2026-01-03'),('2026-02-15','2026-02-23'),('2026-04-04','2026-04-06'),('2026-05-01','2026-05-05'),('2026-06-19','2026-06-21'),('2026-09-25','2026-09-27'),('2026-10-01','2026-10-07')]
def add_source(id,title,url,filename,kind='market',published='2026-11-04',pages=0):
 sources.append(dict(id=id,title=title,company='贵州茅台 / 沪深300' if kind=='market' else '五粮液',url=url,published=published,fetched='2026-11-04',sha256=hashlib.sha256((root/filename).read_bytes()).hexdigest(),pages=pages,kind=kind))
def add(id,label,raw,unit,period,sourceId,page=0,scope=''):
 observations.append(dict(id=id,label=label,raw=raw,unit=unit,period=period,sourceId=sourceId,page=page,scope=scope))
series={}
for name,symbol,adjustment in [('tencent_daily','sh600519','前复权（供应商 qfqday）'),('tencent_benchmark','sh000300','指数点位（day）')]:
 data=json.loads((root/(name+'.txt')).read_text(encoding='utf-8'))
 assert data['code']==0
 block=data['data'][symbol]
 key='qfqday' if symbol=='sh600519' else 'day'
 assert key in block, 'Adjustment contract mismatch'
 rows=block[key]
 assert len(rows)>=200 and rows[-1][0]=='2026-11-04'
 dates=[r[0] for r in rows];assert dates==sorted(set(dates))
 for row in rows:
  date,op,cl,hi,lo,vol=row[:6];assert datetime.date.fromisoformat(date).weekday()<5
  assert not any(a<=date<=b for a,b in closures)
  assert float(lo)<=min(float(op),float(cl))<=max(float(op),float(cl))<=float(hi)
  assert float(lo)>0 and float(vol)>=0
  add(f'{symbol}-close-{date}',('贵州茅台前复权收盘价' if symbol=='sh600519' else '沪深300收盘点位'),cl,'price' if symbol=='sh600519' else 'index',date,name,scope=adjustment)
 series[symbol]=[dict(date=r[0],open=r[1],close=r[2],high=r[3],low=r[4]) for r in rows]
 add_source(name,'腾讯公开行情 · '+('贵州茅台前复权日线' if symbol=='sh600519' else '沪深300日线'),f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,2025-11-01,2026-11-04,500,qfq',name+'.txt')
quote=(root/'tencent_quote.txt').read_text(encoding='utf-8')
quotes=[]
for symbol,body in re.findall(r'v_(\w+)="([^"]*)"',quote):
 if symbol=='sh000300':continue
 f=body.split('~');assert f[30][:8]=='20261104';assert float(f[3])>0
 names={'sh600519':'贵州茅台','sz000568':'泸州老窖','sh600809':'山西汾酒','sz000858':'五粮液'}
 add(symbol+'-spot','不复权收盘价格',f[3],'price',f[30],'tencent_quote',scope='腾讯快照字段3，人民币元/股')
 cap=str(Decimal(f[45])*Decimal('100000000'))
 add(symbol+'-market-cap','供应商总市值',cap,'CNY',f[30],'tencent_quote',scope='腾讯快照字段45，原值 '+f[45]+' 亿元；独立用股本×价格交叉核对主标的')
 quotes.append(dict(symbol=symbol,name=names[symbol],price=f[3],marketCap=cap,time=f[30]))
add_source('tencent_quote','腾讯公开行情 · 同日收盘快照','https://qt.gtimg.cn/q=sh600519,sz000568,sh600809,sz000858,sh000300','tencent_quote.txt')
assert float(series['sh600519'][-1]['close'])==float(next(q['price'] for q in quotes if q['symbol']=='sh600519'))
report=PdfReader(root/'moutai2026q3.pdf')
for id,label,raw,page,unit,scope in [('20269M-equity','归属于上市公司股东的所有者权益','271,204,740,541.63',2,'CNY','合并·归属于母公司股东'),('20269M-shares','实收资本（股本）','1,250,081,601.00',7,'shares','报告期末股本，非自动认定为当前股本')]:
 assert raw in report.pages[page-1].extract_text()
 add(id,label,raw,unit,'2026-09-30','moutai2026q3',page,scope)
market=dict(asOf='2026-11-04',version='market-20261104-v1',stock=series['sh600519'],benchmark=series['sh000300'],quotes=quotes,calendarURL=calendar_url,closures=closures)
(dest/'market.json').write_text(json.dumps(market,ensure_ascii=False,indent=2),encoding='utf-8')

revision_manifest=json.loads((root/'revision-manifest.json').read_text(encoding='utf-8'))
versions=[]
for key,date,revenue,profit,ocf in [('wly2025q3original','2025-10-31','60,945,321,083.57','21,511,276,550.29','28,247,488,416.94'),('wly2025q3updated','2026-04-30','30,637,727,654.97','6,474,551,792.18','28,247,488,416.94')]:
 m=next(m for m in revision_manifest if m['id']==key)
 title='五粮液 2025 年第三季度报告'+('（更新后）' if key.endswith('updated') else '（原始版）')
 add_source(key,title,m['url'],key+'.pdf','filing',date,m['pages'])
 text=PdfReader(root/(key+'.pdf')).pages[0].extract_text()
 for field,label,number in [('revenue','营业收入',revenue),('profit','归母净利润',profit),('ocf','经营现金流量净额',ocf)]:
  assert number in text
  add(key+'-'+field,label,number,'CNY','2025 9M',key,1,'五粮液合并；归母净利润按归属列示')
 versions.append(dict(id=key,published=date,title=title,supersedes='wly2025q3original' if key.endswith('updated') else None,inputs=[key+'-'+f for f in ['revenue','profit','ocf']]))
(dest/'supplement.json').write_text(json.dumps(dict(version='supplement-20261104-v2',sources=sources,observations=observations,versions=versions),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Validated {len(series["sh600519"])} stock and {len(series["sh000300"])} index sessions, {len(observations)} supplemental observations; original and revised filings retained')
