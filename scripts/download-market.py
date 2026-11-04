import urllib.request,json,pathlib,hashlib,sys
from concurrent.futures import ThreadPoolExecutor
ROOT=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "work/filings")
ROOT.mkdir(parents=True,exist_ok=True)
URLS={
 'tencent_quote':'https://qt.gtimg.cn/q=sh600519,sz000568,sh600809,sz000858,sh000300',
 'tencent_daily':'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,2025-11-01,2026-11-04,500,qfq',
 'tencent_benchmark':'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000300,day,2025-11-01,2026-11-04,500,qfq',
}
def run(pair):
 name,url=pair
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  data=urllib.request.urlopen(req,timeout=30).read()
  text=data.decode('gb18030') if name=='tencent_quote' else data.decode('utf-8')
  (ROOT/(name+'.txt')).write_text(text,encoding='utf-8')
  print(json.dumps({'source':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'preview':text[:350]},ensure_ascii=True))
 except Exception as e: print(json.dumps({'source':name,'error':str(e)},ensure_ascii=True))
list(ThreadPoolExecutor(3).map(run,URLS.items()))
