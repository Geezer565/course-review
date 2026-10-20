'use strict';
const REPO = 'https://github.com/Geezer565/course-review';
const app = document.querySelector('#app');
const searchDialog = document.querySelector('#search-dialog');
const searchInput = document.querySelector('#search-input');
let catalog = [], searchIndex, renderToken = 0, searchTimer;
const mediaCache = new Map();
const referenceCache = new Map();
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const subjectHref = id => `#subject/${id}`;
const lessonHref = (subject, lesson, section) => `#lesson/${subject}/${lesson}${section ? '/'+section : ''}`;
async function getJson(path) { const response = await fetch(path); if (!response.ok) throw new Error('资料暂时无法打开，请稍后重试。'); return response.json(); }
function courseCount(s) { return s.lessons.reduce((n,l)=>n+l.count,0); }
function home() {
  document.title = '课内 · 复习知识库';
  app.innerHTML = `<main id="main" class="home"><div class="eyebrow">COURSE NOTES · LEARN & REVISIT</div><h1>课内 · 复习知识库</h1><p class="intro">把课上的知识，整理成随时可以翻开的笔记。<br>从一门课开始，沿着章节读下去，也可以搜索一个还没弄懂的概念。</p><hr class="rule"><h2 class="section-title"><span class="section-sign">§1</span>科目目录 <small>${catalog.length} 门课程 · ${catalog.reduce((n,s)=>n+s.lessons.length,0)} 章笔记</small></h2><div class="course-list">${catalog.map(s=>`<a class="course-card" href="${subjectHref(s.id)}"><span class="course-no">VOL · ${esc(s.icon)}</span><h3>${esc(s.name)}</h3><span class="badge ${s.lessons.length?'':'empty'}">${s.lessons.length?s.lessons.length+' 章':'待补充'}</span><span class="course-arrow">↗</span><p>${esc(s.description)}</p></a>`).join('')}</div><section class="guide" id="guide"><h2 class="section-title"><span class="section-sign">§2</span>怎样使用</h2><p>选一门课，按章节和 1.1、1.2 这样的主题小节阅读。同一问题的概念、条件与解题思路已合并；计算机控制技术的公式、例题和图示可直接在正文阅读；其他科目可展开本节资料。顶部搜索可以查找知识点。</p><p>每篇笔记都提供「修改笔记」入口。登录拥有修改权限的 GitHub 账号后保存，网站更新后，各台设备都能看到新内容。</p><p>目前按已有课件整理；没有资料的科目保留入口，后续继续补充。网站不存放原 PDF。</p></section></main>`;
}
function chapters(s) {
  const groups = new Map();
  s.lessons.forEach(l => { if(!groups.has(l.chapter)) groups.set(l.chapter,[]); groups.get(l.chapter).push(l); });
  return groups;
}
function subjectSidebar(s, active) {
  if (s.organization === 'topics') return `<aside class="sidebar"><a class="back" href="#">← 返回全部科目</a><h3>${esc(s.name)}</h3>${s.lessons.map(l=>`<a class="section-link ${l.id===active?'active':''}" href="${lessonHref(s.id,l.id)}">${esc(l.title)}</a>`).join('')}</aside>`;
  return `<aside class="sidebar"><a class="back" href="#">← 返回全部科目</a><h3>${esc(s.name)}</h3>${[...chapters(s)].map(([ch,ls])=>`<details open><summary>${esc(ch)}</summary>${ls.map(l=>`<a class="section-link ${l.id===active?'active':''}" href="${lessonHref(s.id,l.id)}">${esc(l.title)}</a>`).join('')}</details>`).join('')}</aside>`;
}
function subjectPage(s) {
  document.title = `${s.name} · 课内`;
  const contents=s.lessons.length?s.lessons.map(l=>`<a class="lesson-row" href="${lessonHref(s.id,l.id)}"><strong>${esc(l.title)}</strong><span>${l.sections.map(section=>esc(section.title)).join(' · ')}</span><small>${l.count} 个主题小节 · 开始阅读 →</small></a>`).join(''):`<section class="empty-state"><h2>这门课的笔记，留待下一次补上。</h2><p>目前课程文件夹里还没有资料。科目入口已经准备好了，补充课件后就能继续按章节整理。</p><a href="#">← 先看看其他科目</a></section>`;
  app.innerHTML = `<div class="reading-layout">${subjectSidebar(s)}<main id="main" class="reading"><div class="crumbs"><a href="#">全部科目</a> / ${esc(s.name)}</div><div class="eyebrow">VOL · ${esc(s.icon)}</div><h1>${esc(s.name)}</h1><p class="intro">${esc(s.description)}</p><div class="lesson-meta"><span>${s.lessons.length} 章笔记</span><span>${courseCount(s)} 个主题小节</span></div><div class="chapter-list">${contents}</div></main></div>`;
}
function inline(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
}
function bodyHtml(text, integrated = false) {
  return text.trim().split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean).map(p=>{
    if(p.startsWith('<!-- references:')) {
      if(integrated) return '';
      const match=p.match(/references:([a-z0-9-]+):(\d+)/);
      return match?`<details class="topic-resources" data-reference="${match[1]}" data-topic="${match[2]}"><summary>展开本节补充资料与相关图示</summary><div class="resource-content"><p class="figure-loading">正在打开本节资料…</p></div></details>`:'';
    }
    if(p.startsWith('<!-- visual:')) { const match = p.match(/visual:(?:([a-z0-9-]+):)?(\d+)/); const n = match?.[2]; return n ? `<details class="visual" data-page="${n}" data-source="${match[1]||''}"><summary>展开图示与公式</summary><div class="figure-content"><p class="figure-loading">展开后加载完整图示。</p></div></details>`:''; }
    if(p.startsWith('$$') && p.endsWith('$$')) return `<div class="math-block">${esc(p)}</div>`;
    const figure=p.match(/^!\[([^\]]*)\]\((assets\/[a-zA-Z0-9/_-]+\.webp)\)$/);
    if(figure) return `<figure class="inline-figure"><img src="${figure[2]}" alt="${esc(figure[1])}" loading="lazy" tabindex="0" role="button" aria-label="放大：${esc(figure[1])}"><figcaption>${esc(figure[1])} · 点击放大</figcaption></figure>`;
    if(p.startsWith('### ')) return `<h3>${inline(p.slice(4))}</h3>`;
    if(/^[-*] /.test(p)) return '<ul>'+p.split('\n').map(l=>`<li>${inline(l.replace(/^[-*] /,''))}</li>`).join('')+'</ul>';
    return `<p>${inline(p)}</p>`;
  }).join('');
}
async function lessonPage(s, lesson, section, token) {
  const response = await fetch(lesson.id+'.md');
  if(!response.ok) throw new Error('这篇笔记暂时无法打开。');
  const md = await response.text(); if(token!==renderToken) return;
  const blocks = md.split(/^## /m).slice(1).map((block,i)=>{const end=block.indexOf('\n'); return {title:(end<0?block:block.slice(0,end)).trim(),body:end<0?'':block.slice(end+1),id:i+1};});
  const toc = blocks.map(b=>`<a class="section-link" href="${lessonHref(s.id,lesson.id,b.id)}">${esc(b.title)}</a>`).join('');
  const pos=s.lessons.indexOf(lesson), prev=s.lessons[pos-1], next=s.lessons[pos+1];
  document.title = `${lesson.title} · ${s.name}`;
  app.innerHTML=`<div class="reading-layout"><aside class="sidebar"><a class="back" href="${subjectHref(s.id)}">← ${esc(s.name)}</a><h3>本节目录</h3>${toc}</aside><main id="main" class="reading"><div class="crumbs"><a href="#">全部科目</a> / <a href="${subjectHref(s.id)}">${esc(s.name)}</a></div><div class="eyebrow">${esc(lesson.chapter)}</div><h1>${esc(lesson.title)}</h1><div class="lesson-meta"><span>${blocks.length} 个主题小节</span><span>按主题归纳</span><a href="${REPO}/edit/main/${lesson.id}.md" target="_blank" rel="noopener">修改笔记 ↗</a></div><details class="mobile-toc"><summary>查看本节目录 · ${blocks.length} 个小节</summary>${toc}</details><p class="notice">${lesson.presentation==='integrated'?'公式、推导和例题已放在对应正文中，图示可点击放大。':'同一概念和问题已归并到对应小节。正文用于连贯复习，相关推导、例题和图示可在小节末尾展开。'}</p>${blocks.map(b=>`<section class="knowledge-section" id="section-${b.id}"><h2>${esc(b.title)}</h2>${bodyHtml(b.body,lesson.presentation==='integrated')}</section>`).join('')}<nav class="pager" aria-label="章节翻页">${prev?`<a href="${lessonHref(s.id,prev.id)}">← 上一节<br>${esc(prev.title)}</a>`:`<a href="${subjectHref(s.id)}">← 科目目录</a>`}${next?`<a href="${lessonHref(s.id,next.id)}">下一节 →<br>${esc(next.title)}</a>`:`<a href="${subjectHref(s.id)}">返回科目目录 →</a>`}</nav></main></div>`;
  if (lesson.presentation === 'integrated') {
    renderMathInElement(app, {
      delimiters: [{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],
      throwOnError: false, strict: 'ignore', trust: false
    });
    app.querySelectorAll('.inline-figure img').forEach(img=>{
      const zoom=()=>{const d=document.querySelector('#image-dialog');const full=d.querySelector('img');full.src=img.src;full.alt=img.alt;d.showModal();};
      img.addEventListener('click',zoom);
      img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}});
    });
  }
  document.querySelectorAll('details.visual').forEach(details=>details.addEventListener('toggle',()=>{
    if(details.open&&!details.dataset.loaded) loadFigure(details, details.dataset.source || lesson.id);
  }));
  document.querySelectorAll('details.topic-resources').forEach(details=>details.addEventListener('toggle',()=>{
    if(details.open&&!details.dataset.loaded) loadTopicResources(details);
  }));
  if(section) document.querySelector(`#section-${Number(section)}`)?.scrollIntoView();
}
async function loadTopicResources(details) {
  const container=details.querySelector('.resource-content');
  const slug=details.dataset.reference;
  try {
    if(!referenceCache.has(slug)) referenceCache.set(slug,getJson('reference-'+slug+'.json'));
    const records=(await referenceCache.get(slug))[details.dataset.topic];
    if(!records?.length) throw new Error('未找到本节资料');
    container.replaceChildren();
    const paragraphs=[], seen=new Set();
    records.forEach(record=>record.text.split(/\n\s*\n/).forEach(value=>{
      const p=value.trim(), key=p.replace(/\s/g,'');
      if(key.length<5||!/([\u4e00-\u9fff].*){3}/.test(p)||seen.has(key)||p==='本节内容以图示呈现，展开下方图示阅读。') return;
      seen.add(key);paragraphs.push(p);
    }));
    const gallery=document.createElement('div');gallery.className='topic-gallery';
    const controls=document.createElement('div');controls.className='gallery-controls';
    const previous=document.createElement('button');previous.textContent='← 上一图';
    const label=document.createElement('span');label.setAttribute('aria-live','polite');
    const next=document.createElement('button');next.textContent='下一图 →';
    controls.append(previous,label,next);
    const stage=document.createElement('div');
    gallery.append(controls,stage);container.append(gallery);
    let current=0;
    function show(index) {
      current=index;previous.disabled=index===0;next.disabled=index===records.length-1;
      label.textContent=`相关图示 ${index+1} / ${records.length}`;
      const record=records[index], figure=document.createElement('div');
      figure.className='visual';figure.dataset.page=record.page;
      figure.innerHTML='<div class="figure-content"></div>';stage.replaceChildren(figure);
      loadFigure(figure,record.source);
    }
    previous.addEventListener('click',()=>show(current-1));
    next.addEventListener('click',()=>show(current+1));
    if(paragraphs.length) {
      const supplement=document.createElement('details');supplement.className='supplement';
      const summary=document.createElement('summary');summary.textContent='补充讲义与题目';supplement.append(summary);
      const hint=document.createElement('p');hint.className='resource-note';hint.textContent='相关讲义文字集中放在这里；复杂公式、表格和完整推导请结合上方图示阅读。';supplement.append(hint);
      paragraphs.forEach(value=>{const p=document.createElement('p');p.textContent=value;supplement.append(p);});
      container.append(supplement);
    }
    show(0);details.dataset.loaded='1';
  }catch(e){referenceCache.delete(slug);container.textContent='暂时无法加载，收起后重新展开即可重试。';}
}
async function loadFigure(details, slug) {
  const container=details.querySelector('.figure-content');
  container.innerHTML='<p class="figure-loading" role="status">正在加载图示…</p>';
  try {
    if(!mediaCache.has(slug)) mediaCache.set(slug,getJson('media-'+slug+'.json'));
    const figures=await mediaCache.get(slug);
    const img=document.createElement('img'); img.src=figures[details.dataset.page]; img.alt=`第 ${details.dataset.page} 单元的完整公式与图示`; img.loading='lazy';
    if(!img.src.startsWith('data:image/webp;base64,')) throw new Error('图示无法读取');
    img.addEventListener('click',()=>{const d=document.querySelector('#image-dialog');d.querySelector('img').src=img.src;d.showModal();});
    container.replaceChildren(img); details.dataset.loaded='1';
  } catch(e) { mediaCache.delete(slug); container.innerHTML='<p class="figure-loading">加载失败。收起后重新展开即可重试。</p>'; }
}
let lastPage='';
async function route() {
  const token=++renderToken;
  const [kind,sid,lid,section]=location.hash.slice(1).split('/');
  const key=[kind,sid,lid].join('/');
  if(key===lastPage&&kind==='lesson'&&document.querySelector('.knowledge-section')) {
    document.querySelector(`#section-${Number(section)||1}`)?.scrollIntoView(); return;
  }
  lastPage=key; window.scrollTo(0,0);
  try {
    const s=catalog.find(s=>s.id===sid);
    if(kind==='subject'&&s) subjectPage(s);
    else if(kind==='lesson'&&s) {const l=s.lessons.find(l=>l.id===lid);if(!l) throw new Error('未找到这篇笔记。');await lessonPage(s,l,section,token);}
    else {home();if(kind==='guide') document.querySelector('#guide').scrollIntoView();}
  }catch(error){app.innerHTML=`<main id="main" class="home"><h1>暂时没有打开</h1><p>${esc(error.message)}</p><a href="#">返回科目目录</a></main>`;lastPage='';}
}
async function search() {
  const query=searchInput.value.trim().toLocaleLowerCase();
  const status=document.querySelector('#search-status'), results=document.querySelector('#search-results');
  if(!query){status.textContent='搜索全部科目的标题与正文。';results.replaceChildren();return;}
  status.textContent='正在查找…';
  try {
    searchIndex ||= await getJson('search-index.json');
    if(query!==searchInput.value.trim().toLocaleLowerCase())return;
    const words=query.split(/\s+/);
    const matches=searchIndex.filter(row=>words.every(word=>(row.title+' '+row.text).toLocaleLowerCase().includes(word)));
    matches.sort((a,b)=>Number(b.title.toLocaleLowerCase().includes(query))-Number(a.title.toLocaleLowerCase().includes(query)));
    status.textContent=matches.length?`找到 ${matches.length} 个相关小节${matches.length>60?'，先显示前 60 个':''}。`:'没有找到相关内容，试试换一个关键词。';
    results.innerHTML=matches.slice(0,60).map(row=>{
      const s=catalog.find(s=>s.id===row.subject), l=s.lessons.find(l=>l.id===row.lesson);
      const hit=row.text.toLocaleLowerCase().indexOf(words[0]), start=Math.max(0,hit-35);
      return `<a class="search-result" href="${lessonHref(s.id,l.id,row.section)}"><small>${esc(s.name)} / ${esc(l.title)}</small><strong>${esc(row.title)}</strong><p>${start?'…':''}${esc(row.text.slice(start,start+145))}…</p></a>`;
    }).join('');
    results.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>searchDialog.close()));
  }catch(e){status.textContent='搜索暂时无法加载，请稍后重试。';}
}
document.querySelector('#search-open').addEventListener('click',()=>{searchDialog.showModal();searchInput.focus();});
document.querySelector('#search-close').addEventListener('click',()=>searchDialog.close());
document.querySelector('#image-close').addEventListener('click',()=>document.querySelector('#image-dialog').close());
searchInput.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,150);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!searchDialog.open){e.preventDefault();searchDialog.showModal();searchInput.focus();}});
window.addEventListener('hashchange',route);
getJson('catalog.json').then(data=>{catalog=data;route();}).catch(e=>{app.innerHTML=`<main id="main" class="home"><h1>知识库暂时无法打开</h1><p>${esc(e.message)}</p></main>`;});
