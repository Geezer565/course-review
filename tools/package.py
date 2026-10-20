"""Publish active topic notes without obsolete page-by-page notes."""
from pathlib import Path
import json, shutil
root=Path(__file__).resolve().parents[1]
target=root/'public'
target.mkdir(exist_ok=True)
catalog=json.loads((root/'catalog.json').read_text(encoding='utf8'))
names=['index.html','style.css','app.js','catalog.json','search-index.json','.nojekyll']
names += [lesson['id']+'.md' for subject in catalog for lesson in subject['lessons']]
names += [p.name for pattern in ['media-*.json','reference-*.json'] for p in root.glob(pattern)]
for name in names:
    shutil.copyfile(root/name,target/name)
print('Packaged',len(names),'public files')
