"""Fetch public filings for local verification; PDFs are not bundled with the app."""
import urllib.request
import pathlib
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pypdf import PdfReader

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv)>1 else "work/filings")
ROOT.mkdir(parents=True,exist_ok=True)
ITEMS = {
    'moutai2024': 'https://static.cninfo.com.cn/finalpage/2025-04-03/1222993920.PDF',
    'moutai2025': 'https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-04-17/600519_20260417_9QS4.pdf',
    'moutai2026q3': 'https://static.cninfo.com.cn/finalpage/2026-10-31/1225649896.PDF',
    'luzhou2025': 'https://static.cninfo.com.cn/finalpage/2026-04-29/1225240660.PDF',
    'wuliangye2025': 'https://static.cninfo.com.cn/finalpage/2026-04-30/1225273090.PDF',
    'fenjiu2025': 'https://pdf.dfcfw.com/pdf/H2_AN202604221821466497_1.pdf',
}

def run(item):
    name, url = item
    try:
        data = urllib.request.urlopen(url, timeout=60).read()
        target = ROOT / (name + '.pdf')
        target.write_bytes(data)
        reader = PdfReader(target)
        texts = [page.extract_text() or '' for page in reader.pages]
        target.with_suffix('.txt').write_text('\n'.join(f'\n--- PAGE {i+1} ---\n'+s for i, s in enumerate(texts)), encoding='utf-8')
        return dict(name=name, url=url, bytes=len(data), pages=len(texts), sha256=hashlib.sha256(data).hexdigest())
    except Exception as exc:
        return dict(name=name, error=str(exc))

results = list(ThreadPoolExecutor(6).map(run, ITEMS.items()))
(ROOT / 'manifest.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
for result in results:
    print(json.dumps(result, ensure_ascii=True))
