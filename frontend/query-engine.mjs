// Shared by the browser worker and the Node equivalence tests. No server calls.
export const asciiLower = value => String(value ?? '').replace(/[A-Z]/g, c => c.toLowerCase());
export const contains = (value, query) => asciiLower(value).includes(asciiLower(query));
export const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
export const unpack = packet => packet.rows.map(row => Object.fromEntries(packet.columns.map((key,i) => [key,row[i]])));

function boolean(value) {
  if (typeof value === 'boolean') return value;
  if ([1,'1','true','True','TRUE','yes','Yes','on','ON','t','y'].includes(value)) return true;
  if ([0,'0','false','False','FALSE','no','No','off','OFF','f','n'].includes(value)) return false;
  throw new Error('Expected a boolean value');
}

export function normalize(input, dictionary) {
  const f=structuredClone(dictionary.filters);
  const lists=['complexity','n_term','c_term'];
  for (const [key,value] of Object.entries(input)) {
    if (['page','limit','offset','format'].includes(key)) continue;
    if (!(key in f)) throw new Error('Unknown search parameter: '+key);
    if (lists.includes(key)) {
      f[key]=[...new Set((Array.isArray(value)?value:[value]).flatMap(x=>String(x).split(',')).filter(Boolean))];
    } else if (key.endsWith('_min') || key.endsWith('_max')) {
      if (value==='' || value===null || value===undefined) continue;
      const n=Number(value);
      if (!Number.isFinite(n) || n<0) throw new Error('Invalid numeric range: '+key);
      if (!['value','toxicity'].some(x=>key.startsWith(x+'_')) && !Number.isInteger(n)) throw new Error('An integer is required: '+key);
      if (key.startsWith('year_') && (n<1 || n>9999)) throw new Error('Year must be 1–9999');
      f[key]=n;
    } else if (['has_smiles','has_bonds','ambiguous','include_censored'].includes(key)) {
      if (key==='has_smiles' && (value==='' || value===null)) continue;
      f[key]=boolean(value);
    } else f[key]=String(value ?? '');
  }
  f.corpus=({'9pubs':'publisher_literature','DBAASP':'extended_literature'})[f.corpus] ?? f.corpus;
  const vocabulary={corpus:['','publisher_literature','extended_literature'],unit:['ug','uM'],kind:['MIC','MBC'],sequence_mode:['exact','contains'],species:['',...Object.keys(dictionary.species)],toxicity:['',...dictionary.toxicity],condition_class:['',...(Array.isArray(dictionary.condition_classes)?dictionary.condition_classes:Object.keys(dictionary.condition_classes))]};
  for (const [key,allowed] of Object.entries(vocabulary)) if (!allowed.includes(f[key])) throw new Error('Unknown '+key);
  for (const key of lists) if (f[key].some(x=>!(key==='complexity'?dictionary.complexity:dictionary.termini).includes(x))) throw new Error('Unknown '+key);
  for (const stem of ['length','disulfide','value','toxicity','year']) if (f[stem+'_min']!==null && f[stem+'_max']!==null && f[stem+'_min']>f[stem+'_max']) throw new Error(stem+' minimum exceeds maximum');
  if (!f.species && (f.value_min!==null || f.value_max!==null)) throw new Error('Choose an organism for the activity range');
  if (!f.toxicity && (f.toxicity_min!==null || f.toxicity_max!==null)) throw new Error('Choose a host endpoint for the toxicity range');
  if (f.condition_class && f.kind!=='MIC') throw new Error('Condition classes apply to MIC');
  for (const [key,max] of Object.entries({query:200,pep_id:100,name:200,sequence:10000,journal:200,doi:500})) if (f[key].length>max) throw new Error(key+' is too long');
  return f;
}

function inRange(v,lo,hi) {return v!==null && v!==undefined && (lo===null || v>=lo) && (hi===null || v<=hi);}
export function numericMatch(row,lo,hi,bounds) { return inRange(row.value_num ?? (bounds?row.bound_num:null),lo,hi); }
function grouped(rows,key='pep_id') {
  const map=new Map();for(const row of rows){if(!map.has(row[key]))map.set(row[key],[]);map.get(row[key]).push(row);}return map;
}

export class QueryEngine {
  constructor(manifest, load) {this.manifest=manifest;this.load=load;this.cache=new Map();this.groups=new Map();}
  async dataset(name) {
    if (!this.cache.has(name)) this.cache.set(name,this.load(name));
    return this.cache.get(name);
  }
  async byPeptide(name) {
    if (!this.groups.has(name)) this.groups.set(name,this.dataset(name).then(rows=>grouped(rows)));
    return this.groups.get(name);
  }
  async search(input, {offset=0,limit=30,all=false}={}) {
    const f=normalize(input,this.manifest.dictionary),core=await this.dataset('core');
    const mic=await this.byPeptide('mic_'+f.unit);
    const activity=f.species && f.kind==='MBC'?await this.byPeptide('mbc_'+f.unit):mic;
    const toxicity=f.toxicity?await this.byPeptide('toxicity_'+f.unit):null;
    const species=this.manifest.dictionary.species[f.species];
    const hostAt=f.toxicity.indexOf('_'),hostKind=f.toxicity.slice(0,hostAt),host=f.toxicity.slice(hostAt+1);
    const found=[];
    for (const p of core) {
      if (f.query && !['pep_id','amp_name','sequence','doi','doi_resolved'].some(c=>contains(p[c],f.query))) continue;
      if (f.pep_id && p.pep_id!==f.pep_id) continue;
      if (f.corpus && p.corpus!==f.corpus) continue;
      if (f.name && !contains(p.amp_name,f.name)) continue;
      if (f.journal && !contains(p.journal,f.journal)) continue;
      if (f.doi && p.doi!==f.doi && p.doi_resolved!==f.doi) continue;
      if (f.sequence && (f.sequence_mode==='exact'?asciiLower(p.sequence)!==asciiLower(f.sequence):!contains(p.sequence,f.sequence))) continue;
      if (f.complexity.length && !f.complexity.includes(p.complexity)) continue;
      if (f.n_term.length && !f.n_term.includes(p.n_terminus)) continue;
      if (f.c_term.length && !f.c_term.includes(p.c_terminus)) continue;
      if ((f.length_min!==null || f.length_max!==null) && !inRange(p.sequence_length_num,f.length_min,f.length_max)) continue;
      if ((f.disulfide_min!==null || f.disulfide_max!==null) && !inRange(p.disulfide_bond_count_num,f.disulfide_min,f.disulfide_max)) continue;
      if (f.has_smiles!==null && p.has_reported_smiles!==f.has_smiles) continue;
      if (f.has_bonds && !p.has_intrachain_bonds) continue;
      if (f.ambiguous && !(p.n_ambiguous_residues_num>0)) continue;
      if ((f.year_min!==null || f.year_max!==null) && !inRange(p.publication_year,f.year_min,f.year_max)) continue;
      if (f.species && !(activity.get(p.pep_id)||[]).some(a=>a.species===species && (f.kind!=='MIC' || !f.condition_class || a.condition_class===f.condition_class) && numericMatch(a,f.value_min,f.value_max,f.include_censored))) continue;
      if (f.condition_class && !f.species && !(mic.get(p.pep_id)||[]).some(a=>a.condition_class===f.condition_class)) continue;
      if (f.toxicity && !(toxicity.get(p.pep_id)||[]).some(a=>a.kind===hostKind && a.species===host && numericMatch(a,f.toxicity_min,f.toxicity_max,f.include_censored))) continue;
      found.push(p);
    }
    const page=all?found:found.slice(offset,offset+limit);
    const items=page.map(p=>{
      const candidates=(mic.get(p.pep_id)||[]).filter(a=>a.value_num!==null && (!f.condition_class || a.condition_class===f.condition_class) && (!f.species || f.kind!=='MIC' || a.species===species));
      candidates.sort((a,b)=>a.value_num-b.value_num || compare(a.species,b.species));
      const r={};for(const key of ['pep_id','amp_name','sequence','sequence_length','complexity','n_terminus','c_terminus','corpus','has_ug','has_uM','doi','doi_resolved'])r[key]=p[key];
      r.name=p.amp_name;r.best_mic=candidates[0]?.raw ?? null;return r;
    });
    return {total:found.length,limit,offset,items,filters:f};
  }
  async listing(kind,input={}) {
    const spec={archive:['archive',['peptide_id','name','sequence','article_key']],publications:['publications',['article_key','title','publisher']],activity:['relations_activity',['peptide_id','species','strain','article_key']],toxicity:['relations_toxicity',['peptide_id','host','article_key']],paired:['relations_paired',['peptide_id','species','strain','host','article_key']],observations:['observations_index',['peptide_id','source_id','partner','endpoint','article_key']]};
    if (!spec[kind]) throw new Error('Unknown collection view');
    const [name,fields]=spec[kind],rows=await this.dataset(name),query=input.query||'';
    if(query.length>200)throw new Error('Search text is too long');
    if(kind==='archive' && !['all','core','noncore'].includes(input.scope||'all'))throw new Error('Unknown membership');
    if(kind==='archive' && !['all','recorded'].includes(input.sequence||'all'))throw new Error('Unknown sequence selection');
    const result=rows.filter(r=>{
      if(kind==='archive') {
        if(input.scope==='core' && !r.core_member)return false;
        if(input.scope==='noncore' && r.core_member)return false;
        if(input.sequence==='recorded' && !r.sequence_present)return false;
      }
      if(query && !fields.some(key=>contains(r[key],query)))return false;
      if(input.peptide_id && kind!=='publications' && r.peptide_id!==input.peptide_id)return false;
      if(input.relation_id && kind==='observations' && r.relation_id!==input.relation_id)return false;
      return true;
    });
    const offset=Number(input.offset)||0,limit=Number(input.limit)||30;
    return {total:result.length,offset,limit,items:input.all?result:result.slice(offset,offset+limit)};
  }
}
