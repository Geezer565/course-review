"""Read local teaching materials; publish notes and image data, never PDFs."""
from pathlib import Path
import base64, io, json, re, sys
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.course-review-work'
sys.path.insert(0, str(WORK / 'packages'))

SUBJECTS = [
    dict(id='sensors', name='传感器与检测技术', description='从传感器的工作原理、测量电路，到误差分析与数据处理。', icon='01'),
    dict(id='computer-control', name='计算机控制技术', description='采样与信号转换、离散系统分析、数字控制器设计。', icon='02'),
    dict(id='feedback', name='反馈控制工程基础', description='反馈控制的课程笔记与章节资料。', icon='03'),
    dict(id='microprocessors', name='微处理器系统', description='微处理器原理、接口与系统应用。', icon='04'),
    dict(id='power-electronics', name='电力电子技术', description='电力电子器件、整流与逆变、变流电路及 PWM 控制。', icon='05'),
]
COMPUTER_TITLES = [
    '课程概述与计算机控制系统组成', '计算机控制系统分类与发展',
    '信号采样与零阶保持', '采样定理与量化',
    '信号重构与理想滤波器', '零阶保持器与采样周期选择',
    'D/A 转换原理与性能指标', 'DAC0832 与模拟量输出接口',
    'A/D 转换原理与转换器类型', 'ADC0809 与模拟量输入接口',
    '抗干扰技术与数据处理', '数字滤波与开关量接口',
    'Z 变换及其求解方法', 'Z 变换的性质与应用',
    '脉冲传递函数与采样系统', '时延系统采样与改进 Z 变换',
    '数字控制器实现与有限字长影响', '数字控制系统分析与设计基础',
    '模拟调节器的离散化方法', '离散等效设计与方法比较',
    '数字 PID 控制算法', '数字 PID 改进与参数整定',
    '直接数字设计与最少拍系统', '最少拍系统的可实现性与稳定性',
]
SENSOR_CHAPTERS = {1:'第 1 章 · 概述', 2:'第 2 章 · 传感器的基本特性', 3:'第 3 章 · 电阻式传感器', 4:'第 4 章 · 电感式传感器', 5:'第 5 章 · 电容式传感器', 6:'第 6 章 · 压电式传感器', 7:'第 7 章 · 磁敏式传感器', 18:'第 18 章 · 误差理论与数据处理', 99:'习题与参考答案'}

def natural(p):
    return [int(s) if s.isdigit() else s for s in re.split(r'(\d+)', p.name)]

def tidy(text):
    text = re.sub(r'[\ue000-\uf8ff]', '', text)
    text = text.replace('\ufffd','').replace('\x00','')
    text = re.sub(r'(?<=\S)[ \t]{3,}(?=\S)', ' ', text)
    return text.strip()

def lines_of(page):
    return [tidy(s) for s in page.get_text(sort=True).splitlines() if tidy(s)]

def title_for(lines, fallback, page_no):
    choices=[]
    for line in lines[:12]:
        clean=re.sub(r'^[•●◆◇□■\s]+','',line).strip()
        if 3 <= len(clean) <= 65 and re.search(r'[\u4e00-\u9fff]{2}',clean):
            if not re.search(r'(知识单元|与知识点|^第\s*\d+\s*章|^传感器与检测技术$)',clean):
                choices.append(clean)
    return choices[0] if choices else f'{fallback} · 内容 {page_no:02d}'

def paragraphs(lines, heading):
    result=[]
    pending=''
    for line in lines:
        if re.fullmatch(r'\d{1,3}',line) or line==heading: continue
        # Keep every line; restore reading paragraphs without changing formula symbols.
        if re.match(r'^[•●–—]|^\d+[、）)]|^\d+\.\d+|^[（(]\d+[）)]',line):
            if pending: result.append(pending); pending=''
            result.append(line)
        elif len(line) < 5 or (not re.search(r'[\u4e00-\u9fff]',line)):
            if pending: result.append(pending); pending=''
            result.append(line)
        else:
            if pending and not re.search(r'[。；！？：:]$',pending): pending+=line
            else:
                if pending: result.append(pending)
                pending=line
    if pending: result.append(pending)
    return '\n\n'.join(result)

def webp(page):
    scale=1600/page.rect.width
    pix=page.get_pixmap(matrix=pymupdf.Matrix(scale,scale),alpha=False)
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    buf=io.BytesIO(); im.save(buf,format='WEBP',quality=84,method=4)
    return 'data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()

def sources(subject):
    if subject['id']=='sensors':
        for p in sorted((ROOT/subject['name']).glob('*.pdf'),key=natural):
            m=re.match(r'(\d+)',p.name); ch=int(m[1]) if m else 99
            title=p.stem
            if title=='3.1 工作原理': title='3.1 电阻式传感器的工作原理'
            if title=='6.1 工作原理': title='6.1 压电式传感器的工作原理'
            yield p,SENSOR_CHAPTERS[ch],title
    elif subject['id']=='computer-control':
        for p in sorted((ROOT/subject['name']).rglob('*.pdf'),key=natural):
            m=re.search(r'第(\d+)课.*?([12])\.pdf$',p.name)
            if not m: continue  # personal submitted homework is outside course notes
            n=int(m[1]); half=int(m[2]); title=COMPUTER_TITLES[(n-1)*2+half-1]
            ch=1 if n==1 else 2 if n<=7 else 3 if n<=9 else 4 if n<=11 else 5
            chapter={1:'第 1 章 · 计算机控制系统概述',2:'第 2 章 · 信号转换与接口技术',3:'第 3 章 · 离散系统分析与控制器实现',4:'第 4 章 · 模拟调节器离散化与数字 PID',5:'第 5 章 · 直接数字设计'}[ch]
            yield p,chapter,f'第 {n} 课{("上","下")[half-1]} · {title}'
    elif subject['id']=='power-electronics':
        for p in sorted((WORK/'power').glob('*.pdf'),key=natural):
            yield p,p.stem,p.stem

def convert():
    if (OUT/'catalog.json').exists() and any(s.get('organization')=='topics' for s in json.loads((OUT/'catalog.json').read_text(encoding='utf8'))):
        raise SystemExit('已整理为主题笔记，停止原始逐页导入，避免覆盖整理成果。')
    catalog=[]; search=[]; audit=[]
    for subject in SUBJECTS:
        lessons=[]
        for i,(path,chapter,title) in enumerate(sources(subject),1):
            slug=f'{subject["id"]}-{i:02d}'
            mdpath=OUT/f'{slug}.md'; mediapath=OUT/f'media-{slug}.json'
            cache=WORK/f'{slug}-cache.json'
            if cache.exists():
                record=json.loads(cache.read_text(encoding='utf8'))
                if record['sourceSize']==path.stat().st_size and mdpath.exists() and mediapath.exists():
                    lessons.append(record['lesson']); search.extend(record['search']); audit.append(record['audit']); continue
            doc=pymupdf.open(path); media={}; entries=[]; pages=[]; md=[f'# {title}', '', f'> {chapter}', '']
            for j,page in enumerate(doc,1):
                lines=lines_of(page)
                page_title=title_for(lines,title,j)
                body=paragraphs(lines,page_title)
                # Original figures preserve all diagrams, equations and scanned material.
                media[str(j)]=webp(page)
                md.extend([f'## {page_title}', '',body or '本节内容以图示呈现，展开下方图示阅读。','',f'<!-- visual:{j} -->',''])
                entry={'subject':subject['id'],'lesson':slug,'section':j,'title':page_title,'text':' '.join(lines)}
                entries.append(entry); pages.append({'title':page_title,'index':j})
            mdpath.write_text('\n'.join(md),encoding='utf8')
            mediapath.write_text(json.dumps(media,separators=(',',':')),encoding='utf8')
            lesson={'id':slug,'title':title,'chapter':chapter,'sections':pages,'count':len(doc)}
            row={'lesson':slug,'source':path.name,'sourcePages':len(doc),'sections':len(pages),'textCharacters':sum(len(e['text']) for e in entries),'mediaBytes':mediapath.stat().st_size}
            cache.write_text(json.dumps({'sourceSize':path.stat().st_size,'lesson':lesson,'search':entries,'audit':row},ensure_ascii=False),encoding='utf8')
            lessons.append(lesson); search.extend(entries); audit.append(row)
            print(f'{slug}: {len(doc)} sections, {mediapath.stat().st_size//1024} KB',flush=True)
        catalog.append({**subject,'lessons':lessons})
    (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    (OUT/'search-index.json').write_text(json.dumps(search,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    (WORK/'conversion-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
    print('DONE',sum(r['sourcePages'] for r in audit),'sections',flush=True)

if __name__=='__main__': convert()
