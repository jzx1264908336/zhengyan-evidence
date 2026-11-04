"""Create a compact numeric snapshot. Every value must occur on its cited PDF page.
Usage: python scripts/import-filings.py ../research
Public filings stay outside the source repository. Only factual table values and
our own paraphrases are published, with original URLs, page locators and hashes.
"""
import json, sys, re
from pathlib import Path
from pypdf import PdfReader

root=Path(sys.argv[1] if len(sys.argv)>1 else '../research')
manifest={x['name']:x for x in json.loads((root/'manifest.json').read_text(encoding='utf-8'))}
names={'moutai2024':('贵州茅台','2024 年年度报告','2025-04-03'), 'moutai2025':('贵州茅台','2025 年年度报告','2026-04-17'), 'moutai2026q3':('贵州茅台','2026 年第三季度报告','2026-10-31'), 'luzhou2025':('泸州老窖','2025 年年度报告','2026-04-29'), 'wuliangye2025':('五粮液','2025 年年度报告摘要','2026-04-30'), 'fenjiu2025':('山西汾酒','2025 年年度报告','2026-04-23')}
sources=[]; pages={}; observations=[]
for key,(company,title,date) in names.items():
 m=manifest[key]; sources.append(dict(id=key,title=company+' '+title,company=company,url=m['url'],published=date,fetched='2026-11-04',sha256=m['sha256'],pages=m['pages']))
 pages[key]=[p.extract_text() or '' for p in PdfReader(root/(key+'.pdf')).pages]

def add(id,label,raw,period,source,page,scope='合并',unit='CNY'):
 if raw not in pages[source][page-1]: raise ValueError(f'{id}: {raw} missing on {source} page {page}')
 observations.append(dict(id=id,label=label,raw=raw,unit=unit,period=period,sourceId=source,page=page,scope=scope))

for year,rev,profit,ocf,roe in [
 ('2023','147,693,604,994.14','74,734,071,550.75','66,593,247,721.09','34.19'),
 ('2024','170,899,152,276.34','86,228,146,421.62','92,463,692,168.43','36.02'),
 ('2025','168,838,102,514.79','82,320,067,101.68','61,522,204,989.35','32.53')]:
 for field,label,value in [('revenue','营业收入',rev),('parentProfit','归母净利润',profit),('ocf','经营活动现金流量净额',ocf)]:add(year+'-'+field,label,value,year+' FY','moutai2025',6, '合并·归属于母公司股东' if field=='parentProfit' else '合并')
 add(year+'-roe','加权平均净资产收益率',roe,year+' FY','moutai2025',6,'归母·加权平均','percent')

for year,cost,totalProfit in [('2025','14,892,277,570.91','85,310,324,833.67'),('2024','13,789,482,367.98','89,334,728,025.90')]:
 add(year+'-cost','营业成本',cost,year+' FY','moutai2025',61)
 add(year+'-totalProfit','合并净利润',totalProfit,year+' FY','moutai2025',62)

for year,rev,profit,ocf,cost,totalProfit,salesCash in [
 ('2026','130,970,743,649.04','64,467,425,981.95','84,058,979,832.29','13,645,718,932.90','66,717,143,218.04','143,522,752,519.23'),
 ('2025','128,453,707,655.86','64,626,746,712.18','38,196,802,155.27','11,183,972,073.77','66,898,804,746.17','138,791,719,991.59')]:
 for field,label,val,page in [('revenue','营业收入',rev,8),('parentProfit','归母净利润',profit,9),('ocf','经营活动现金流量净额',ocf,11),('cost','营业成本',cost,8),('totalProfit','合并净利润',totalProfit,9),('salesCash','销售商品、提供劳务收到的现金',salesCash,10)]:
  add(year+'9M-'+field,label,val,year+' 9M','moutai2026q3',page,'合并·归属于母公司股东' if field=='parentProfit' else '合并')

for year,deposit,bank in [('2026','-774,901,684.37','-22,715,439,598.84'),('2025','-8,659,745,768.25','12,507,272,127.36')]:
 add(year+'9M-deposit','客户存款和同业存放款项净增加额',deposit,year+' 9M','moutai2026q3',10)
 add(year+'9M-bank','存放中央银行和同业款项净增加额',bank,year+' 9M','moutai2026q3',11)

for q,rev,profit,ocf in [
 (1,'50,600,957,885.78','26,847,474,238.76','8,809,195,646.38'),(2,'38,788,396,531.06','18,555,488,059.34','4,309,865,384.95'),(3,'39,064,353,239.02','19,223,784,414.08','25,077,741,123.94'),(4,'40,384,394,858.93','17,693,320,389.50','23,325,402,834.08')]:
 for field,label,val in [('revenue','营业收入',rev),('parentProfit','归母净利润',profit),('ocf','经营活动现金流量净额',ocf)]:add(f'2025Q{q}-{field}',label,val,f'2025 Q{q}','moutai2025',7,'合并·归属于母公司股东' if field=='parentProfit' else '合并')

for code,src,page,rev25,rev24,p25,p24,roe in [
 ('000568.SZ','luzhou2025',7,'25,731,010,647.32','31,196,248,208.33','10,830,713,936.14','13,472,986,476.01','22.66'),
 ('600809.SH','fenjiu2025',5,'38,718,257,657.74','36,010,992,321.46','12,246,329,337.25','12,242,884,323.77','33.48'),
 ('000858.SZ','wuliangye2025',3,'40,528,509,770.23','89,175,178,322.70','8,954,257,202.51','31,853,172,533.98','6.89')]:
 for year,rev,pro in [('2025',rev25,p25),('2024',rev24,p24)]:
  add(code+'-'+year+'-revenue','营业收入',rev,year+' FY',src,2 if src=='wuliangye2025' else page)
  add(code+'-'+year+'-parentProfit','归母净利润',pro,year+' FY',src,page,'合并·归属于母公司股东')
 add(code+'-2025-roe','加权平均净资产收益率',roe,'2025 FY',src,page,'归母·加权平均','percent')

notes=[
 dict(id='N-cash',title='公司披露：现金流变动涉及财务公司',text='公司将前三季度经营现金流变动主要归因于财务公司同业存款到期收回，以及吸收集团成员单位存款净增加额变动。该解释来自公司披露，尚未单独审计验证。',sourceId='moutai2026q3',page=3,kind='disclosure'),
 dict(id='N-annual',title='2025 年现金流的比较背景',text='年报说明经营现金流减少主要涉及财务公司吸收成员单位存款减少，以及不可随时支取的同业存款增加。',sourceId='moutai2025',page=6,kind='disclosure'),
 dict(id='N-audit',title='2026 年三季报未经审计',text='2026 年第三季度报告明确标注财务报表未经审计。季度报告与经审计年度报告的保证程度不同。',sourceId='moutai2026q3',page=1,kind='limitation'),
 dict(id='N-wly',title='五粮液：收入确认调整影响可比性',text='五粮液年报摘要说明，2025 年部分业务收入确认核算调整，季度数据与此前披露存在重大差异。因此保留展示，但默认从同比中位数中排除。',sourceId='wuliangye2025',page=3,kind='limitation'),
 dict(id='N-channel',title='渠道结构是下一步核验方向',text='三季报按直销、批发代理披露收入，并列示 i 茅台不含税收入；这些是收入结构信息，不能替代终端库存与消费者实际动销数据。',sourceId='moutai2026q3',page=3,kind='limitation'),
]
data=dict(version='filings-20261104-v1',asOf='2026-11-04',company=dict(name='贵州茅台',code='600519.SH',industry='白酒 · 非金融企业',description='以茅台酒及系列酒为主营；合并报表包含财务公司，现金流需结合业务边界理解。'),sources=sources,observations=observations,notes=notes)
out=Path(__file__).resolve().parents[1]/'lib/research/snapshot.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Verified {len(observations)} numeric observations against cited PDF pages; wrote {out}')
