import {gunzip} from './data-provider.mjs';
import {numericMatch} from './query-engine.mjs';
export function* parseCSV(text) {
  let row=[],cell='',quoted=false;
  if(text[0]==='\ufeff')text=text.slice(1);
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}
    else if(c==='"' && cell==='')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n' || c==='\r'){if(c==='\r' && text[i+1]==='\n')i++;row.push(cell);yield row;row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Truncated CSV');
  if(cell || row.length){row.push(cell);yield row;}
}
export const csvLine = row => row.map(v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}).join(',')+'\n';
export function rowsCSV(rows) {const header=[...new Set(rows.flatMap(Object.keys))];return '\ufeff'+csvLine(header)+rows.map(r=>csvLine(header.map(k=>typeof r[k]==='object'&&r[k]!==null?JSON.stringify(r[k]):r[k]))).join('');}
export async function exportSearch(engine,provider,input,format) {
  const result=await engine.search(input,{all:true}),f=result.filters,core=await engine.dataset('core');
  const selected=new Map(result.items.map(p=>[p.pep_id,p]));
  if(format==='fasta')return {text:result.items.filter(p=>p.sequence && p.sequence!=='NR').map(p=>'>'+p.pep_id+'|'+p.amp_name+'\n'+p.sequence+'\n').join(''),records:result.items.filter(p=>p.sequence && p.sequence!=='NR').length};
  const spec=provider.manifest.downloads['conditions_summary_'+f.unit];
  const text=new TextDecoder().decode(await gunzip(await provider.fetchBytes(spec.path,spec)));
  const mic=await engine.byPeptide('mic_'+f.unit),species=provider.manifest.dictionary.species[f.species];
  const classes=new Map();
  for(const pid of selected.keys()) {
    const rows=mic.get(pid)||[];
    const matching=f.species && f.kind==='MIC'?new Set(rows.filter(r=>r.species===species && numericMatch(r,f.value_min,f.value_max,f.include_censored)).map(r=>r.condition_class)):null;
    const allowed=new Set(rows.filter(r=>(!f.condition_class||r.condition_class===f.condition_class) && (!matching||matching.has(r.condition_class))).map(r=>r.condition_class));
    classes.set(pid,allowed.size?allowed:new Set(['UNKNOWN']));
  }
  const iterator=parseCSV(text),header=iterator.next().value;
  const pidIndex=header.indexOf('APEXD_pep_id'),classIndex=header.indexOf('condition_class');
  if(pidIndex<0||classIndex<0)throw new Error('Summary schema mismatch');
  const rows=new Map();
  for(const row of iterator) {
    if(row.length!==header.length)throw new Error('Summary CSV row width mismatch');
    const pid=row[pidIndex];
    if(selected.has(pid) && classes.get(pid).has(row[classIndex])) {
      if(!rows.has(pid))rows.set(pid,[]);rows.get(pid).push(row);
    }
  }
  const parts=['\ufeff'+csvLine([...header,'selected_unit','unit_row_present','has_ug','has_uM'])];let count=0;
  const fallback=core.some(p=>selected.has(p.pep_id) && !p['has_'+f.unit])?new Map((await engine.dataset('export_fallback')).map(p=>[p.pep_id,p])):new Map();
  for(const p of core)if(selected.has(p.pep_id)) {
    const present=!!p['has_'+f.unit];
    let variants=rows.get(p.pep_id);
    if(!variants) {
      if(present)throw new Error('Missing selected condition row for '+p.pep_id);
      const metadata=fallback.get(p.pep_id);if(!metadata)throw new Error('Missing unit-absent metadata');
      const original=Object.fromEntries(Object.entries(provider.manifest.dictionary.static_map).map(([key,value])=>[key,metadata[value]??'']));
      original.condition_class='UNKNOWN';original.split_group_id=!original.dup_group_id||original.dup_group_id==='NR'?'pep_'+p.pep_id:original.dup_group_id;
      variants=[header.map(k=>original[k]??'')];
    }
    variants.sort((a,b)=>a[classIndex]<b[classIndex]?-1:a[classIndex]>b[classIndex]?1:0);
    for(const row of variants){parts.push(csvLine([...row,f.unit,String(present),p.has_ug,p.has_uM]));count++;}
  }
  return {text:parts.join(''),records:count};
}
