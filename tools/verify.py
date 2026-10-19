"""Small delivery checks: exact course scope, notes, figures and search coverage."""
from pathlib import Path
import base64, io, json, re
from PIL import Image

root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'catalog.json').read_text(encoding='utf8'))
index=json.loads((root/'search-index.json').read_text(encoding='utf8'))
assert [s['name'] for s in catalog]==['传感器与检测技术','计算机控制技术','反馈控制工程基础','微处理器系统','电力电子技术']
assert not list(root.rglob('*.pdf')) and not list(root.rglob('*.ppt*'))
total=0
for s in catalog:
    for l in s['lessons']:
        text=(root/(l['id']+'.md')).read_text(encoding='utf8')
        assert len(re.findall(r'^## ',text,re.M))==l['count'], l['id']
        figures=json.loads((root/('media-'+l['id']+'.json')).read_text())
        refs=re.findall(r'<!-- visual:(\d+) -->',text)
        assert len(refs)==l['count'] and all(n in figures for n in refs),l['id']
        for n in {refs[0],refs[-1]}:
            raw=base64.b64decode(figures[n].split(',',1)[1]); Image.open(io.BytesIO(raw)).verify()
        total+=l['count']
assert total==len(index)
for row in index:
    assert row['title'] and row['section']>0
print(json.dumps({'subjects':len(catalog),'lessons':sum(len(s['lessons']) for s in catalog),'sections':total,'pdfFiles':0,'totalMB':round(sum(p.stat().st_size for p in root.glob('*') if p.is_file())/1024**2,1)},ensure_ascii=False))
