import {DataProvider} from './data-provider.mjs';
import {QueryEngine} from './query-engine.mjs';
import {exportSearch,rowsCSV} from './export.mjs';
let provider,engine,ready;
async function identity(pid) {
  const archive=await engine.dataset('archive'),ordinal=archive.findIndex(p=>p.peptide_id===pid);
  if(ordinal<0) {
    const legacy=(await engine.dataset('legacy')).find(r=>r.old_pep_id===pid);
    return legacy?{legacy}:/^DB\d{4}_P\d+$/.test(pid)?{legacy:{old_pep_id:pid,disposition:'retired_unmapped',new_pep_id:null,doi:'',match_basis:''}}:null;
  }
  return (await provider.detail('identity',pid,Math.floor(ordinal/provider.manifest.bucket_size)))[0];
}
self.onmessage=async ({data:{id,type,args}})=>{
  try {
    let result;
    if(type==='init') {
      provider=new DataProvider(args.dataBase,args.lock,message=>self.postMessage({id,type:'progress',message}));
      ready=provider.start().then(manifest=>{engine=new QueryEngine(manifest,name=>provider.dataset(name));return manifest;});
      result=await ready;
    } else {
      await ready;
      if(type==='search')result=await engine.search(args.filters,args.options);
      else if(type==='listing')result=await engine.listing(args.kind,args.filters);
      else if(type==='identity')result=await identity(args.id);
      else if(type==='detail') {
        result=await provider.detail(args.kind,args.id,args.bucket);
        if(['legacy_activity','core_conditions'].includes(args.kind)) {
          const marked=(await engine.byPeptide('figure_columns')).get(args.id)||[];
          const provenance=args.kind==='legacy_activity'?await provider.detail('provenance',args.id,args.bucket):[];
          result=result.map(row=>{
            const columns=marked.filter(x=>x.unit===row.unit).map(x=>x.column);let yes=false;
            if(args.kind==='core_conditions')yes=row.column_type==='value' && columns.includes(row.column_name);
            else {
              const key=row.kind+'_'+row.species;
              let related=columns.filter(c=>c.startsWith(key+' ')||c.startsWith(key+'__'));
              if(row.kind==='MIC' && row.cond_fingerprint==='standard') {
                const conditions=new Set(provenance.filter(p=>p.organism===row.species && p.unit_variant===row.unit && (p.condition_fingerprint==='(generic)'||p.medium_class==='MHB-standard')).map(p=>p.condition_fingerprint));
                related=related.filter(c=>(c.startsWith(key+' ') && conditions.has('(generic)')) || [...conditions].some(condition=>c.startsWith(key+'__'+condition+' (')));
              }
              yes=related.length>0;
            }
            return {...row,digitized_from_figure:yes&&!['','NR'].includes(row.raw)};
          });
        }
      }
      else if(type==='structure')result=(await provider.json(provider.manifest.structures))[args.id]||null;
      else if(type==='article') {
        const publications=await engine.dataset('publications'),aliases=await engine.dataset('article_aliases'),allRecords=await engine.dataset('article_records');
        const activeIds=new Set(allRecords.map(a=>a.article_id));
        const resolved=new Set(aliases.filter(a=>activeIds.has(a.article_id) && (a.raw_doi===args.key || a.doi_resolved===args.key)).map(a=>a.doi_resolved));
        const key=resolved.size===1?[...resolved][0]:null;
        const article=publications.find(a=>a.article_key===key);
        const items=(await engine.dataset('archive')).filter(p=>p.article_key===key);
        const articleIds=new Set(items.map(p=>p.article_id));
        const records=allRecords.filter(a=>articleIds.has(a.article_id));
        result=article?{article,items,records,aliases:aliases.filter(a=>articleIds.has(a.article_id))}:null;
      } else if(type==='export') {
        const exported=await exportSearch(engine,provider,args.filters,args.format);
        result={blob:new Blob([exported.text],{type:args.format==='csv'?'text/csv;charset=utf-8':'text/plain;charset=utf-8'}),records:exported.records};
      } else if(type==='export-list') {
        const rows=(await engine.listing(args.kind,{...args.filters,all:true})).items;
        result={blob:new Blob([rowsCSV(rows)],{type:'text/csv;charset=utf-8'}),records:rows.length};
      } else throw new Error('Unknown request');
    }
    self.postMessage({id,type:'result',result});
  } catch(error){self.postMessage({id,type:'error',message:error.message});}
};
