from pathlib import Path
from collections import Counter
import base64,io,json,re
from PIL import Image
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'catalog.json').read_text(encoding='utf8'))
index=json.loads((root/'search-index.json').read_text(encoding='utf8'))
assert [s['name'] for s in catalog]==['传感器与检测技术','计算机控制技术','反馈控制工程基础','微处理器系统','电力电子技术']
assert not list(root.glob('*.pdf')) and not list(root.glob('*.ppt*'))
assigned=[];total=0
for subject in catalog:
    assert subject['organization']=='topics'
    for lesson in subject['lessons']:
        text=(root/(lesson['id']+'.md')).read_text(encoding='utf8')
        blocks=re.split(r'^## ',text,flags=re.M)[1:]
        assert len(blocks)==lesson['count'],lesson['id']
        references=json.loads((root/('reference-'+lesson['id']+'.json')).read_text(encoding='utf8'))
        assert len(references)==len(blocks)
        for i,block in enumerate(blocks,1):
            title,_,body=block.partition('\n')
            assert re.match(r'^\d+\.\d+\s',title),title
            assert len(body.split('<!-- references:')[0].strip())>=80,title
            assert f'<!-- references:{lesson["id"]}:{i} -->' in body
            assigned.extend((r['source'],r['page']) for r in references[str(i)])
        total+=len(blocks)
counts=Counter(assigned)
assert len(assigned)==1625 and len(counts)==1625 and all(v==1 for v in counts.values())
for source in {s for s,_ in assigned}:
    images=json.loads((root/('media-'+source+'.json')).read_text())
    pages=[str(page) for s,page in assigned if s==source]
    assert all(page in images for page in pages),source
    for page in {pages[0],pages[-1]}:
        Image.open(io.BytesIO(base64.b64decode(images[page].split(',',1)[1]))).verify()
assert total==len(index)
print(json.dumps({'chapters':sum(len(s['lessons']) for s in catalog),'topicSections':total,'sourceUnitsPreserved':len(counts),'pdfFiles':0},ensure_ascii=False))
