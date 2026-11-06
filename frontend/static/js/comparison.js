const section=document.getElementById('database-comparison');
const n=x=>Number(x).toLocaleString('en-US');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=document.querySelector('meta[name="tiger-base"]')?.content||'/';
function cell(v){return `<td>${esc(v)}</td>`;}
function drawHeatmap(rows){
 const hosts=['Human erythrocytes','Mouse erythrocytes','HEK293','HEK293T','HK-2','NIH-3T3','97H','HaCaT','HepG2'];
 const species=[...new Set(rows.map(r=>r.species))].sort((a,b)=>rows.filter(r=>r.species===b).reduce((s,r)=>s+r.links,0)-rows.filter(r=>r.species===a).reduce((s,r)=>s+r.links,0));
 const values=new Map(rows.map(r=>[r.species+'|'+r.host,r.links])),max=Math.max(...rows.map(r=>r.links));
 const color=v=>{if(!v)return '#ffffff';const t=Math.log10(v)/Math.log10(max),a=[230,245,240],b=[8,71,130];return `rgb(${a.map((x,k)=>Math.round(x+(b[k]-x)*t)).join(',')})`;};
 let svg='<svg viewBox="0 0 960 510" role="img" aria-label="TIGER microbial–host evidence links"><title>Microbial–host evidence coverage</title><desc>Color indicates the logarithm of the link count. An accessible table follows the figure.</desc>';
 species.forEach((s,i)=>{svg+=`<text x="170" y="${39+i*28}" text-anchor="end" font-size="13">${esc(s)}</text>`;hosts.forEach((h,j)=>{const v=values.get(s+'|'+h)||0,description=`${s} · ${h}: ${n(v)} links`;svg+=`<rect class="heatmap-cell" tabindex="0" role="img" aria-label="${esc(description)}" x="${180+j*76}" y="${20+i*28}" width="74" height="26" fill="${color(v)}" stroke="#dce7e6"><title>${esc(description)}</title></rect>`;});});
 hosts.forEach((h,j)=>{svg+=`<text transform="translate(${217+j*76},398) rotate(-42)" text-anchor="end" font-size="12">${esc(h.replace('erythrocytes','RBC'))}</text>`;});
 const ticks=[1,10,100,1000,max];ticks.forEach((v,j)=>{svg+=`<rect x="${210+j*133}" y="480" width="26" height="14" fill="${color(v)}"/><text x="${241+j*133}" y="491" font-size="12">${n(v)}</text>`;});svg+='</svg>';
 document.getElementById('comparison-heatmap').innerHTML=svg;
 document.querySelectorAll('.heatmap-cell').forEach(el=>{const show=()=>document.getElementById('heatmap-selection').textContent=el.getAttribute('aria-label');el.addEventListener('focus',show);el.addEventListener('mouseenter',show);el.addEventListener('click',show);});
 document.querySelector('#heatmap-table thead').innerHTML='<tr><th scope="col">Microbial category</th>'+hosts.map(h=>`<th scope="col">${esc(h)}</th>`).join('')+'</tr>';
 document.querySelector('#heatmap-table tbody').innerHTML=species.map(s=>'<tr><th scope="row">'+esc(s)+'</th>'+hosts.map(h=>cell(n(values.get(s+'|'+h)||0))).join('')+'</tr>').join('');
}
function drawIntersections(data){
 const rows=data.intersections,sets=data.datasets,w=960,h=340,left=150,plotw=w-left-20,step=plotw/rows.length,max=Math.max(...rows.map(r=>r.count));
 let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Exact sequence intersections for ${esc(sets.join(', '))}"><title>Exact sequence intersections</title><desc>Bar heights show counts; the membership dots indicate which collections contain each sequence. All values are provided in the table below.</desc>`;
 svg+='<line x1="150" y1="185" x2="940" y2="185" stroke="#8b989f"/>';
 rows.forEach((r,i)=>{const x=left+step*(i+.5),barh=155*r.count/max,names=sets.filter((s,k)=>r.membership[k]==='1'),color=r.membership==='1000'?'#00796b':r.membership[0]==='1'?'#526b7a':'#bac4cb';svg+=`<g class="intersection-mark" tabindex="0" role="img" aria-label="${esc(names.join(' and '))}: ${n(r.count)} sequences"><title>${esc(names.join(' ∩ '))}: ${n(r.count)}</title><rect x="${x-step*.34}" y="${185-barh}" width="${step*.68}" height="${barh}" fill="${color}"/><text x="${x}" y="${178-barh}" text-anchor="middle" font-size="12">${n(r.count)}</text>`;const ys=[];sets.forEach((s,k)=>{if(r.membership[k]==='1')ys.push(220+k*29);});svg+=`<line x1="${x}" x2="${x}" y1="${Math.min(...ys)}" y2="${Math.max(...ys)}" stroke="${color}"/>`;sets.forEach((s,k)=>{svg+=`<circle cx="${x}" cy="${220+k*29}" r="4.5" fill="${r.membership[k]==='1'?color:'#e2e7e9'}"/>`;});svg+='</g>';});
 sets.forEach((s,k)=>{svg+=`<text x="140" y="${224+k*29}" text-anchor="end" font-size="13">${esc(s)}</text>`;});svg+='</svg>';
 document.getElementById('comparison-upset').innerHTML=svg;
 document.querySelector('#intersection-table tbody').innerHTML=rows.map(r=>`<tr>${cell(sets.filter((s,k)=>r.membership[k]==='1').join(' ∩ '))}${cell(n(r.count))}</tr>`).join('');
}
function renderScope(all,key){
 const s=all.scopes[key];
 document.getElementById('comparison-summary').innerHTML=`<strong>${n(s.unmatched)} of ${n(s.total)} sequences (${(100*s.unmatched/s.total).toFixed(1)}%)</strong><br>in the TIGER ${esc(s.label)} were not matched to the three comparator collections combined.`;
 document.getElementById('comparison-bars').innerHTML=s.by_database.map(r=>`<div class="comparison-bar-row"><span class="comparison-bar-label">${esc(r.label)}</span><div class="comparison-bar-track" role="img" aria-label="${n(r.shared)} shared and ${n(r.unmatched)} unmatched TIGER sequences"><span class="comparison-bar-shared"></span><span class="comparison-bar-added"></span></div><span class="comparison-bar-value">${n(r.unmatched)} unmatched</span></div>`).join('')+'<p class="comparison-legend"><span><i></i>Shared with comparator</span><span><i></i>TIGER sequences unmatched to comparator</span></p>';
 // CSP disallows inline style attributes; set widths and colors through CSSOM.
 document.querySelectorAll('.comparison-bar-track').forEach((e,i)=>{e.children[0].style.width=(100*s.by_database[i].shared/s.total)+'%';e.children[1].style.width=(100*s.by_database[i].unmatched/s.total)+'%';});
 document.querySelectorAll('.comparison-legend i').forEach((e,i)=>e.style.backgroundColor=['#8da6b5','#00796b'][i]);
 document.getElementById('intersection-title').textContent=`Exact sequence intersections: TIGER ${s.label}`;
 drawIntersections(s.upset);
}
async function main(){
 const response=await fetch(base+'static/comparison/20261106/comparison.json');if(!response.ok)throw Error('Comparison file unavailable');const data=await response.json();
 document.querySelector('#source-record-counts tbody').innerHTML=data.source_records.map(r=>`<tr><th scope="row">${esc(r.database)}</th>${cell(n(r.activity_count)+' '+r.activity_unit)}${cell(n(r.toxicity_count)+' '+r.toxicity_unit)}${cell(r.scope)}</tr>`).join('');
 document.querySelector('#harmonized-signatures tbody').innerHTML=data.harmonized.rows.map(r=>`<tr><th scope="row">${esc(r.database)}</th>${cell(n(r.activity_signatures))}${cell(n(r.toxicity_signatures))}</tr>`).join('');
 document.getElementById('harmonized-definition').textContent=data.harmonized.definition+' '+data.harmonized.interpretation;
 document.getElementById('harmonized-selection').textContent=data.harmonized.selection;
 document.getElementById('harmonized-revision').textContent=data.harmonized.rule_version+': '+data.harmonized.revision;
 const refs=data.bibliography;
 document.querySelector('#reference-coverage tbody').innerHTML=refs.rows.map(r=>`<tr><th scope="row">${esc(r.database)}</th>${cell(n(r.source_identities))}${cell(n(r.matched))}${cell(n(r.unmatched))}${cell(n(r.needs_review))}${cell(n(r.articles_preprints)+' articles/preprints; '+n(r.patents)+' patents; '+n(r.other_sources)+' other sources')}</tr>`).join('');
 document.getElementById('reference-coverage-note').textContent=`Across the three databases, the unmatched list contains ${n(refs.unmatched_unique_articles_preprints)} distinct articles/preprints and ${n(refs.unmatched_unique_patents)} patent identities. Unmatched means absent from the current TIGER reference index; eligibility for inclusion is assessed separately. Conflicting or unresolved citation identities stay in the review column.`;
 document.getElementById('source-quality-note').textContent=`Source quality review: ${n(data.source_quality.source_safety_rows_with_operator_in_unit)} safety rows contain a comparison operator in the unit field. ${data.source_quality.treatment}`;
 document.querySelector('#comparison-counts tbody').innerHTML=data.collections.map(r=>`<tr><th scope="row">${esc(r.label)}</th>${cell(n(r.records))}${cell(n(r.sequences))}${cell(r.record_definition)}</tr>`).join('');
 document.getElementById('comparison-evidence').innerHTML=data.evidence.map(r=>`<article><h4>${esc(r.database)}</h4><p class="evidence-count">${n(r.count)}</p><p class="evidence-kind">${esc(r.unit)}</p><p>${esc(r.definition)}</p><a href="${esc(r.url)}">Source and database →</a></article>`).join('');
 const audit=data.measurement_audit,coverage=data.pair_key_coverage.coverage;
 const auditRows=[['Entities / native entries with shared-unit pairs',data.tiger_stages[2].entities,audit.common_scope_paired_native_entries],['Shared-native-unit strain–host combinations',data.tiger_stages[2].links,audit.common_scope_native_unit_pairs],['Entities / native entries with exact-value pairs',data.tiger_stages[3].entities,audit.common_scope_exact_paired_native_entries],['Combinations with exact observations on both sides',data.tiger_stages[3].links,audit.common_scope_exact_pairs],['Shared-host sequence–strain–host keys',coverage.all.TIGER,coverage.all.DBAASP],['Shared-host keys with exact observations on both sides',coverage.exact.TIGER,coverage.exact.DBAASP]];
 document.querySelector('#quantitative-pairing tbody').innerHTML=auditRows.map(r=>`<tr><th scope="row">${esc(r[0])}</th>${cell(n(r[1]))}${cell(n(r[2]))}</tr>`).join('');
 document.getElementById('pair-coverage-description').textContent=`After restricting to the ${data.pair_key_coverage.shared_hosts.length} host categories observed in both parsed subsets, the shared-unit selection contains ${n(coverage.all.shared)} common coverage keys, ${n(coverage.all.TIGER_only)} TIGER-only keys and ${n(coverage.all.DBAASP_only)} DBAASP-only keys. Requiring exact observations on both sides yields ${n(coverage.exact.shared)} common, ${n(coverage.exact.TIGER_only)} TIGER-only and ${n(coverage.exact.DBAASP_only)} DBAASP-only keys.`;
 document.querySelector('#comparison-stages tbody').innerHTML=data.tiger_stages.map(r=>`<tr><th scope="row">${esc(r.label)}</th>${cell(n(r.entities))}${cell(r.links===null?'—':n(r.links))}</tr>`).join('');
 document.getElementById('comparison-methods').innerHTML=data.methods.map(t=>`<p>${esc(t)}</p>`).join('')+'<p>'+data.sources.map(s=>`<a href="${esc(s.url)}">${esc(s.label)}</a>`).join(' · ')+'</p>';
 renderScope(data,'core');document.getElementById('comparison-scope').addEventListener('change',e=>renderScope(data,e.target.value));
 drawHeatmap(data.species_host_links);
 document.getElementById('comparison-loading').hidden=true;document.getElementById('comparison-content').hidden=false;
}
if(section)main().catch(e=>{document.getElementById('comparison-loading').textContent='The comparison could not be loaded. Reload this page to retry.';console.error(e);});
