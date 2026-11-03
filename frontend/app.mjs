const meta=name=>document.querySelector(`meta[name="${name}"]`)?.content;
const base=meta('tiger-base'),release=meta('tiger-release'),page=document.body.dataset.staticPage;
const dataBase=new URL(base+'data/'+release+'/',location.origin).href;
const status=document.getElementById('static-status');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>Number(value).toLocaleString('en-US');
const url=(path,params={})=>base+path.replace(/^\//,'').replace(/\/?$/,'/')+(Object.keys(params).length?'?'+new URLSearchParams(params):'');
const peptideLink=id=>`<a class="id-link" href="${escape(url('peptide',{id}))}">${escape(id)}</a>`;
const articleLink=(key,label='Source publication')=>`<a href="${escape(url('article',{key}))}">${escape(label)}</a>`;
const figure=v=>v===true||v===1||v==='1'||v==='true'?'<span class="figure-badge">Figure-derived</span>':'';
const value=v=>v===null||v===undefined?'<span class="empty-note">Not available</span>':v===''?'<span class="empty-note">Empty in source</span>':escape(typeof v==='object'?JSON.stringify(v,null,2):v);
const heading=(eyebrow,title,description='')=>`<header class="page-heading"><p class="eyebrow">${escape(eyebrow)}</p><h1>${escape(title)}</h1>${description?'<p>'+description+'</p>':''}</header>`;
let worker,ready,manifest,requestId=0,latestSearch=0;const pending=new Map();
function call(type,args={}) {
  const id=++requestId;
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,args});});
}
async function start() {
  if(!ready) {
    worker=new Worker(new URL('./search-worker.mjs',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(data.type==='progress'){status.textContent=data.message;return;}
      const task=pending.get(data.id);if(!task)return;pending.delete(data.id);
      if(data.type==='error')task.reject(new Error(data.message));else task.resolve(data.result);
      if(!pending.size)status.textContent='';
    };
    worker.onerror=()=>{for(const task of pending.values())task.reject(new Error('The search worker stopped. Reload this page to retry.'));pending.clear();};
    ready=call('init',{dataBase,lock:{release_id:release,manifest_sha256:meta('tiger-manifest-sha256')}}).then(x=>manifest=x);
  }
  return ready;
}
function failure(error,container) {
  status.textContent=error.message;
  if(container)container.innerHTML=`<div class="static-error" role="alert"><h2>Unable to load these records</h2><p>${escape(error.message)}</p><a href="${escape(location.href)}">Reload this page →</a></div>`;
}
function params() {
  const p=new URLSearchParams(location.search),r={};
  for(const key of new Set(p.keys()))r[key]=['complexity','n_term','c_term'].includes(key)?p.getAll(key):p.get(key);
  return r;
}
function populate(form,p) {
  for(const input of form.elements) {
    if(!input.name)continue;
    const v=p[input.name];if(v===undefined)continue;
    if(input.type==='checkbox')input.checked=Array.isArray(v)?v.flatMap(x=>x.split(',')).includes(input.value):v===input.value;
    else input.value=v;
  }
  form.dispatchEvent(new Event('change',{bubbles:true}));
}
function pagination(result,callback) {
  const current=Math.floor(result.offset/result.limit)+1,total=Math.max(1,Math.ceil(result.total/result.limit));
  const nav=document.createElement('nav');nav.className='pagination';nav.setAttribute('aria-label','Result pages');
  nav.innerHTML=`<button type="button" ${current<=1?'disabled':''} data-direction="-1">← Previous</button><p>Page ${n(current)} of ${n(total)}</p><button type="button" ${current>=total?'disabled':''} data-direction="1">Next →</button>`;
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>callback(current+Number(b.dataset.direction))));return nav;
}
function table(headers,rows) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable results"><table class="results-table"><thead><tr>${headers.map(h=>'<th>'+escape(h)+'</th>').join('')}</tr></thead><tbody>${rows.length?rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join(''):`<tr><td colspan="${headers.length}">No matching records.</td></tr>`}</tbody></table></div>`;
}
function save(blob,name) {
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),30000);
}
function exportButtons(container,kind,filters) {
  const bar=document.createElement('div');bar.className='search-exports';
  bar.innerHTML=`<button type="button" data-format="csv">Download all matching rows CSV ↓</button>${kind==='search'?'<button type="button" data-format="fasta">FASTA ↓</button>':''}<span role="status"></span>`;
  bar.querySelectorAll('button').forEach(button=>button.addEventListener('click',async()=>{
    const note=bar.querySelector('span');bar.querySelectorAll('button').forEach(b=>b.disabled=true);note.textContent='Preparing the complete result set…';
    try {const result=await call(kind==='search'?'export':'export-list',{kind,filters,format:button.dataset.format});save(result.blob,'TIGER_'+kind+'_'+release+'.'+button.dataset.format);note.textContent=n(result.records)+' rows exported.';}
    catch(error){note.textContent=error.message;}
    finally{bar.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }));container.append(bar);
}
async function coreSearch() {
  const box=document.querySelector('#search-results'),form=document.querySelector('.search-filters');
  const p=params();populate(form,p);
  const input={...p};delete input.page;
  const current=Number(p.page||1);if(!Number.isInteger(current)||current<1||current>100000)throw new Error('Invalid result page');
  const ticket=++latestSearch;await start();
  const result=await call('search',{filters:input,options:{offset:(current-1)*30,limit:30}});if(ticket!==latestSearch)return;
  box.innerHTML=`<div class="results-heading"><p><strong data-result-total>${n(result.total)}</strong> records</p><span>30 per page · ${result.filters.unit==='ug'?'µg/mL':'µM'}</span></div>`;
  document.querySelector('.mobile-results-link').textContent='View '+n(result.total)+' matching records ↓';
  exportButtons(box,'search',input);
  if(result.total===0 && (input.pep_id||input.query)) {
    const id=await call('identity',{id:input.pep_id||input.query});
    if(id)box.insertAdjacentHTML('beforeend',`<p class="notice">${id.legacy?'This identifier has a retirement or replacement record.':'This entity is available in the complete archive.'} ${peptideLink(input.pep_id||input.query)}</p>`);
  }
  box.insertAdjacentHTML('beforeend',table(['Peptide / Name','Sequence / Length','Complexity','N / C termini','Lowest exact MIC','Units'],result.items.map(p=>[
    peptideLink(p.pep_id)+`<span class="result-name">${escape(p.amp_name)}</span>`,
    `<span class="sequence-preview" title="${escape(p.sequence)}">${escape(p.sequence)}</span><small>${escape(p.sequence_length)} residues</small>`,value(p.complexity),value(p.n_terminus)+'<br>'+value(p.c_terminus),value(p.best_mic),(p.has_ug?'µg/mL ':'')+(p.has_uM?'µM':'')])));
  box.insertAdjacentHTML('beforeend','<p class="table-note">Lowest exact MIC is the smallest class summary matching your unit and MIC filters. Open a record for class-level values.</p>');
  box.append(pagination(result,number=>{const p=new URLSearchParams(location.search);p.set('page',number);history.pushState({},'',location.pathname+'?'+p);coreSearch().catch(e=>failure(e,box));}));
}
const evidenceKinds={activity:'Peptide–strain activity relations',toxicity:'Peptide–host toxicity relations',paired:'Connected activity–toxicity evidence',observations:'Qualifying source measurements'};
async function collectionPage() {
  const box=document.getElementById('dynamic-page'),p=params(),kind=page==='relations'?(p.kind||'activity'):page;
  if(page==='relations' && !(kind in evidenceKinds))throw new Error('Unknown evidence view');
  const title=kind==='archive'?'Explore every peptide record.':kind==='publications'?'Source publications':evidenceKinds[kind];
  box.innerHTML=heading('THE LITERATURE COLLECTION',title,kind==='archive'?'Search literature-specific entities, including records outside the core concentration tables.':kind==='paired'?'Follow linked activity and toxicity measurements for the same peptide, strain and host.':'Follow original source records and their experimental evidence.');
  if(page==='relations')box.insertAdjacentHTML('beforeend',`<nav class="scope-tabs" aria-label="Evidence view">${Object.entries(evidenceKinds).map(([k,v])=>`<a href="${escape(url('relations',{kind:k}))}" ${k===kind?'aria-current="page"':''}>${escape(k==='paired'?'Connected evidence':k==='observations'?'Source measurements':k==='activity'?'Activity':'Toxicity')}</a>`).join('')}</nav>`);
  box.insertAdjacentHTML('beforeend',`<form class="collection-filter" action="${escape(url(page))}" method="get">${page==='relations'?`<input type="hidden" name="kind" value="${escape(kind)}">`:''}${p.relation_id?`<input type="hidden" name="relation_id" value="${escape(p.relation_id)}">`:''}<label>Search records<input name="query" type="search" maxlength="200" value="${escape(p.query||'')}" placeholder="Peptide, sequence or source reference"></label>${kind==='archive'?'<label>Membership<select name="scope"><option value="all">All entity records</option><option value="core">Core members</option><option value="noncore">Outside the core</option></select></label><label>Sequence field<select name="sequence"><option value="all">All records</option><option value="recorded">Non-missing</option></select></label>':page==='relations'?`<label>Exact peptide ID<input name="peptide_id" maxlength="100" value="${escape(p.peptide_id||'')}"></label>`:''}<button class="button" type="submit">Apply</button></form><section id="collection-results"><p class="loading-note">Loading records…</p></section>`);
  populate(box.querySelector('form'),p);await start();
  const filters={...p};delete filters.page;delete filters.kind;
  const current=Number(p.page||1);if(!Number.isInteger(current)||current<1||current>100000)throw new Error('Invalid result page');
  const r=await call('listing',{kind,filters:{...filters,offset:(current-1)*30,limit:30}}),results=box.querySelector('#collection-results');
  results.innerHTML=`<h2 data-result-total>${n(r.total)} ${kind==='publications'?'publications':kind==='archive'?'entity records':'records'}</h2>`;exportButtons(results,kind,filters);
  if(kind==='archive')results.insertAdjacentHTML('beforeend',table(['Entity ID','Reported name','Membership','Sequence field','Source'],r.items.map(p=>[peptideLink(p.peptide_id),value(p.name),p.core_member?'Core':'Archive only',`<span class="sequence-preview">${escape(p.sequence)}</span>`,articleLink(p.article_key)])));
  else if(kind==='publications')results.insertAdjacentHTML('beforeend',`<div class="publication-list">${r.items.map(p=>`<article><p class="eyebrow">${escape(p.publisher)} · ${escape(p.year||'Year not reported')}</p><h3>${articleLink(p.article_key,p.title&&p.title!=='NR'?p.title:p.article_key)}</h3><p class="reference-key">${escape(p.article_key)}</p><p>${n(p.entity_count)} entities · ${n(p.core_count)} core members</p></article>`).join('')||'<p>No publications match these filters.</p>'}</div>`);
  else {
    const evidence=id=>`<a href="${escape(url('relations',{kind:'observations',relation_id:id}))}">View measurements →</a>`;
    const headers=kind==='activity'?['Peptide','Species','Strain / isolate','Measurements','Exact / censored','Evidence']:kind==='toxicity'?['Peptide','Host','Measurements','Exact / censored','Evidence']:kind==='paired'?['Peptide','Species','Strain / isolate','Host','Linked evidence']:['Peptide','Source record','Target / host','Endpoint','Reported value','Unit','State','Context'];
    results.insertAdjacentHTML('beforeend',table(headers,r.items.map(v=>kind==='activity'?[peptideLink(v.peptide_id),value(v.species),value(v.strain),n(v.measurements),`${n(v.exact)} / ${n(v.censored)}`,evidence(v.relation_id)]:kind==='toxicity'?[peptideLink(v.peptide_id),value(v.host),n(v.measurements),`${n(v.exact)} / ${n(v.censored)}`,evidence(v.relation_id)]:kind==='paired'?[peptideLink(v.peptide_id),value(v.species),value(v.strain),value(v.host),evidence(v.activity_relation_id)+'<br>'+evidence(v.toxicity_relation_id)]:[peptideLink(v.peptide_id),value(v.source_id),value(v.species)+' '+value(v.partner),value(v.endpoint),value(v.value_raw)+' '+figure(v.digitized_from_figure),value(v.unit_raw),value(v.value_status),`<a href="${escape(url('peptide',{id:v.peptide_id,view:'observations',record:v.observation_id}))}">Source context →</a>`])));
  }
  results.append(pagination(r,number=>{const p=new URLSearchParams(location.search);p.set('page',number);history.pushState({},'',location.pathname+'?'+p);collectionPage().catch(e=>failure(e,results));}));
}
function fields(record,keys=Object.keys(record)) {
  return '<dl class="detail-fields">'+keys.filter(k=>k in record).map(k=>`<dt>${escape(k.replaceAll('_',' '))}</dt><dd>${value(record[k])}</dd>`).join('')+'</dl>';
}
const detailViews={condition_summaries:'MIC class summaries',safety:'Host-cell response',measurements:'Source activity',observations:'Qualifying evidence',core_conditions:'Source-condition values',condition_records:'Assay conditions',condition_groups:'MIC condition groups',measurement_values:'Unit representations',summary_sources:'Summary membership',aggregation:'Aggregation evidence',aggregation_links:'Aggregation membership',source_evidence:'Source evidence',provenance:'Cell provenance',exclusions:'Exclusion audit',references:'References',legacy_activity:'Historical source cells'};
const unitKinds=new Set(['condition_summaries','core_conditions','condition_groups','measurement_values','source_evidence','aggregation','legacy_activity']);
const priorityFields=['species','target_species_standard','strain_or_isolate','target_name_raw','host_cell_or_species','cell_line','endpoint','endpoint_final','kind','condition_class','raw','value_raw','unit','unit_raw','value_status','censor_op','value_num','bound_num','medium','assay_method','inoculum_raw','temperature','pH','incubation_time','evidence_location'];
async function peptidePage() {
  const box=document.getElementById('dynamic-page'),p=params(),pid=p.id;if(!pid)throw new Error('Choose a peptide from the archive to open its record.');
  await start();const identity=await call('identity',{id:pid});
  if(!identity)throw new Error('Peptide record not found: '+pid);
  if(identity.legacy) {
    box.innerHTML=heading('RECORD HISTORY','Retired identifier',escape(pid))+fields(identity.legacy);
    if(identity.legacy.new_pep_id)box.insertAdjacentHTML('beforeend',`<p>Open the current record: ${peptideLink(identity.legacy.new_pep_id)}</p>`);return;
  }
  const peptide=identity.peptide,unit=p.unit|| (peptide.has_ug?'ug':'uM');if(!['ug','uM'].includes(unit))throw new Error('Unknown unit dataset');
  const view=p.view&&p.view in detailViews?p.view:'condition_summaries';
  box.innerHTML=heading(peptide.core_member?'CORE ENTITY RECORD':'COMPLETE ARCHIVE RECORD',pid,escape(peptide.amp_name))+
    `<div class="detail-grid"><section><p>${articleLink(peptide.doi_resolved||peptide.doi,peptide.doi_resolved||peptide.doi)}</p><h2>Sequence</h2><div class="record-sequence">${value(peptide.sequence)} ${figure(peptide.sequence_digitized_from_figure)}</div><button class="button button-light" type="button" id="copy-sequence">Copy sequence</button>${fields(peptide,['complexity','sequence_length','complete_sequence','n_terminus','c_terminus','intrachain_bonds','disulfide_bond_count','sequence_notes'])}<details><summary>All identity and annotation fields</summary>${fields(peptide)}</details></section><section id="structure-view"><h2>Molecular description</h2>${identity.structure?fields(identity.structure):'<p>No compiled molecular description for this entity.</p>'}<p class="loading-note">Loading structure depiction…</p></section></div>`+
    `<section class="record-section"><h2>Measurements and evidence</h2><div class="unit-tabs"><a href="${escape(url('peptide',{id:pid,unit:'ug',view}))}" ${unit==='ug'?'aria-current="true"':''}>µg/mL</a><a href="${escape(url('peptide',{id:pid,unit:'uM',view}))}" ${unit==='uM'?'aria-current="true"':''}>µM</a></div><p class="table-note">The unit switch selects summarized concentrations. Original activity and safety records retain their reported units.</p>${!peptide['has_'+unit]?'<p class="notice">This entity has no core row in the selected unit dataset. Original source evidence remains available below.</p>':''}<div class="detail-tabs" aria-label="Record sections">${Object.entries(detailViews).map(([k,label])=>`<button type="button" data-detail="${k}" aria-pressed="${k===view}">${escape(label)}</button>`).join('')}</div><div id="detail-rows"></div></section>`;
  box.querySelector('#copy-sequence').addEventListener('click',async e=>{try{await navigator.clipboard.writeText(peptide.sequence||'');e.target.textContent='Sequence copied';}catch{status.textContent='Select the sequence text to copy it.';}});
  const renderInfo=await call('structure',{id:pid}),structure=box.querySelector('#structure-view');structure.querySelector('.loading-note').remove();
  if(renderInfo?.path)structure.insertAdjacentHTML('beforeend',`<img src="${escape(dataBase+renderInfo.path)}" alt="Two-dimensional structural depiction of ${escape(pid)}" loading="lazy"><p class="table-note">Depiction from curated structural annotations. The original literature-reported SMILES is shown separately below.</p>`);
  else structure.insertAdjacentHTML('beforeend','<p class="table-note">A structural image is not available for this record. Sequence and modification annotations are shown alongside.</p>');
  structure.insertAdjacentHTML('beforeend',`<details><summary>Literature-reported SMILES</summary><div class="record-sequence">${value(peptide.smiles_reported)}</div></details>`);
  let activeTicket=0;
  async function show(kind,pageNumber=1) {
    const ticket=++activeTicket,container=box.querySelector('#detail-rows');container.innerHTML='<p class="loading-note">Loading '+escape(detailViews[kind])+'…</p>';
    box.querySelectorAll('[data-detail]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.detail===kind)));
    let rows=await call('detail',{kind,id:pid,bucket:identity.bucket});if(ticket!==activeTicket)return;
    if(unitKinds.has(kind))rows=rows.filter(r=>r.unit===unit);
    if(kind==='provenance')rows=rows.filter(r=>r.unit_variant===unit);
    if(p.record && kind==='observations')rows=rows.filter(r=>r.observation_id===p.record);
    const offset=(pageNumber-1)*30,items=rows.slice(offset,offset+30);
    container.innerHTML=`<div class="section-heading"><h3>${escape(detailViews[kind])}</h3><span data-detail-total>${n(rows.length)} records</span></div>`;
    if(!rows.length)container.insertAdjacentHTML('beforeend','<p>No records in this section for the selected dataset.</p>');
    for(const row of items) {
      const title=row.measurement_id||row.safety_id||row.summary_id||row.observation_id||row.column_name||row.aggregation_id||row.evidence_id||row.source_id||row.doi||row.provenance_id||kind;
      const keys=priorityFields.filter(k=>k in row);
      container.insertAdjacentHTML('beforeend',`<article class="detail-card"><h3>${escape(title)} ${figure(row.digitized_from_figure)}</h3>${fields(row,keys.length?keys:Object.keys(row).slice(0,7))}<details><summary>All fields and source context</summary>${fields(row)}</details></article>`);
    }
    container.append(pagination({offset,limit:30,total:rows.length},number=>show(kind,number).catch(e=>failure(e,container))));
    const query=new URLSearchParams(location.search);query.set('view',kind);history.replaceState({},'',location.pathname+'?'+query);
  }
  box.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.detail).catch(e=>failure(e,box.querySelector('#detail-rows')))));
  await show(view);
}
async function articlePage() {
  await start();const key=params().key;if(!key)throw new Error('Choose a source publication to open its records.');
  const r=await call('article',{key});if(!r)throw new Error('Source publication not found');
  const box=document.getElementById('dynamic-page');box.innerHTML=heading('SOURCE PUBLICATION',r.article.title&&r.article.title!=='NR'?r.article.title:r.article.article_key)+fields(r.article);
  if(r.article.basis!=='directory_literal' && /^10\.\d{4,9}\//.test(r.article.article_key))box.insertAdjacentHTML('beforeend',`<p><a href="https://doi.org/${escape(encodeURI(r.article.article_key))}">Open original publication ↗</a></p>`);
  box.insertAdjacentHTML('beforeend',`<details><summary>Source article records and reference aliases</summary>${r.records.map(a=>fields(a)).join('')}${r.aliases.map(a=>fields(a)).join('')}</details><section class="record-section"><h2>${n(r.items.length)} peptide entities</h2><div id="article-entities"></div></section>`);
  const render=number=>{const target=box.querySelector('#article-entities'),offset=(number-1)*30;target.innerHTML=table(['Peptide','Name','Sequence','Membership'],r.items.slice(offset,offset+30).map(p=>[peptideLink(p.peptide_id),value(p.name),`<span class="sequence-preview">${value(p.sequence)}</span>`,p.core_member?'Core':'Archive only']));target.append(pagination({total:r.items.length,limit:30,offset},render));};render(1);
}
async function downloads() {
  const file=new URL('downloads/APEXD_summary_v2.csv.gz',dataBase).href;
  document.getElementById('python-example').textContent=`import pandas as pd\n\nurl = ${JSON.stringify(file)}\ndata = pd.read_csv(url, compression="gzip", keep_default_na=False)\n# Each row is a peptide × MIC condition class.\nprint(data.shape)`;
  document.getElementById('r-example').textContent=`url <- ${JSON.stringify(file)}\ndownload.file(url, "TIGER_summary.csv.gz", mode = "wb")\ndata <- read.csv(gzfile("TIGER_summary.csv.gz"),\n                 check.names = FALSE, na.strings = NULL)`;
  if(params().dataset) {
    await start();const name=params().dataset,entry=manifest.supplementary?.[name],box=document.getElementById('supplementary-download');box.hidden=false;
    if(entry)box.innerHTML=`<h2>${escape(name.replaceAll('_',' '))}</h2><p><a class="button" href="${escape(dataBase+entry.path)}" download>Download ${escape(entry.path.split('/').pop())} ↓</a></p><p>${n(entry.rows??0)} records · ${n(entry.bytes)} bytes</p><code class="wrap-code">SHA-256 ${escape(entry.sha256)}</code>`;
    else box.innerHTML='<p>Select a dataset from the collection views above.</p>';
  }
}
async function run() {
  if(page==='search')return coreSearch();
  if(['archive','publications','relations'].includes(page))return collectionPage();
  if(page==='peptide')return peptidePage();
  if(page==='article')return articlePage();
  if(page==='download')return downloads();
}
window.addEventListener('popstate',()=>run().catch(e=>failure(e,document.getElementById('dynamic-page')||document.querySelector('#search-results'))));
run().catch(e=>failure(e,document.getElementById('dynamic-page')||document.querySelector('#search-results')));
