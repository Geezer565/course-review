"""Rebuild navigation and search from the editable notes, using Python stdlib."""
from pathlib import Path
import json, re

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
index = []
reference_cache = {}
for subject in catalog:
    for lesson in subject['lessons']:
        note = root / (lesson['id'] + '.md')
        text = note.read_text(encoding='utf-8')
        title = re.search(r'^# (.+)$', text, re.M)
        if title:
            lesson['title'] = title[1].strip()
        blocks = re.split(r'^## ', text, flags=re.M)[1:]
        sections = []
        for i, block in enumerate(blocks, 1):
            heading, _, body = block.partition('\n')
            sections.append({'title': heading.strip(), 'index': i})
            plain = re.sub(r'<!--.*?-->', '', body, flags=re.S)
            for slug, topic in re.findall(r'<!-- references:([a-z0-9-]+):(\d+) -->', body):
                if slug not in reference_cache:
                    reference_cache[slug] = json.loads((root / ('reference-' + slug + '.json')).read_text(encoding='utf-8'))
                records = reference_cache[slug][topic]
                plain += '\n' + '\n'.join(record['title'] + '\n' + record['text'] for record in records)
            plain = re.sub(r'\s+', ' ', plain).strip()
            index.append(dict(subject=subject['id'], lesson=lesson['id'], section=i, title=heading.strip(), text=plain))
        lesson['sections'] = sections
        lesson['count'] = len(sections)
(root / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(root / 'search-index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(catalog)} subjects; {len(index)} sections indexed')
