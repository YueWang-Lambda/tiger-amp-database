"""Check the published comparison's set identities, scopes and evidence totals."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
data=root/'frontend/static/comparison/20261106'
j=json.loads((data/'comparison.json').read_text())
assert j['status']=='COMPLETE'
assert j['snapshot_date']=='2026-11-04'
assert j['audit_revision_date']=='2026-11-06'
assert j['version']=='TIGER-COMPARISON-20261106'
collection_sizes={r['label']:r['sequences'] for r in j['collections']}
for scope,s in j['scopes'].items():
 assert s['shared']+s['unmatched']==s['total']
 rows=s['upset']['intersections'];bits=[r['membership'] for r in rows]
 assert len(set(bits))==len(bits)==15
 assert all(len(b)==4 and set(b)<={'0','1'} and b!='0000' for b in bits)
 assert sum(r['count'] for r in rows if r['membership'][0]=='1')==s['total']
 assert next(r['count'] for r in rows if r['membership']=='1000')==s['unmatched']
 for i,db in enumerate(['DRAMP 5.0','DBAASP v4','dbAMP 3.0'],1):
  assert sum(r['count'] for r in rows if r['membership'][i]=='1')==collection_sizes[db]
  overlap=s['by_database'][i-1]
  assert overlap['shared']==sum(r['count'] for r in rows if r['membership'][0]==r['membership'][i]=='1')
  assert overlap['shared']+overlap['unmatched']==s['total']
assert sum(r['links'] for r in j['species_host_links'])==j['tiger_stages'][1]['links']==19888
assert len({(r['species'],r['host']) for r in j['species_host_links']})==len(j['species_host_links'])
stages=j['tiger_stages'];assert all(a['entities']>=b['entities'] for a,b in zip(stages,stages[1:]))
assert j['measurement_audit']['downloaded_entries']==14221
for key in ['common_scope_native_unit_pairs','common_scope_paired_native_entries','common_scope_exact_pairs','common_scope_exact_paired_native_entries']:assert j['measurement_audit'][key]>0
assert j['measurement_audit']['common_scope_exact_pairs']<=j['measurement_audit']['common_scope_native_unit_pairs']
for scope,row in j['pair_key_coverage']['coverage'].items():
 assert row['TIGER']==row['TIGER_only']+row['shared']
 assert row['DBAASP']==row['DBAASP_only']+row['shared']
sources={r['database']:r for r in j['source_records']}
assert len(sources)==len(j['source_records'])==5
for row in j['collections']:
 assert row['records']==sources[row['label']]['native_entries']
assert sources['TIGER complete archive']['activity_count']==346095
assert sources['TIGER complete archive']['toxicity_count']==36218
assert sources['TIGER core subset']['activity_count']==313005
assert sources['TIGER core subset']['toxicity_count']==32250
assert sources['DBAASP v4']['activity_count']==197338
assert sources['DBAASP v4']['toxicity_count']==23692
assert sources['DRAMP 5.0']['activity_unit'].startswith('entries')
assert sources['dbAMP 3.0']['toxicity_unit'].startswith('entries')
assert j['harmonized']['rule_version']=='HARMONIZED-AMP-1.1.0'
signatures={r['database']:r for r in j['harmonized']['rows']}
assert signatures.keys()==sources.keys()
for name,row in signatures.items():
 assert row['native_entries']==sources[name]['native_entries']
 assert all(isinstance(row[k],int) and row[k]>0 for k in ('activity_signatures','toxicity_signatures'))
 if name in ('TIGER complete archive','TIGER core subset','DBAASP v4'):
  assert row['activity_signatures']<=sources[name]['plain_MIC_count']
  assert row['toxicity_signatures']<=sources[name]['toxicity_count']
for metric in ('activity_signatures','toxicity_signatures'):
 assert signatures['TIGER core subset'][metric]<=signatures['TIGER complete archive'][metric]
refs=j['bibliography'];assert len(refs['rows'])==3
for row in refs['rows']:
 assert row['source_identities']==row['matched']+row['unmatched']+row['needs_review']
 assert row['source_identities']==row['articles_preprints']+row['patents']+row['other_sources']
 assert row['unmatched_articles_preprints']<=row['unmatched']
assert refs['unmatched_unique_articles_preprints']==4862 and refs['unmatched_unique_patents']==541
assert j['source_quality']['source_safety_rows_with_operator_in_unit']==258
import csv
for filename,json_rows in [('source_record_counts.tsv',j['source_records']),('harmonized_signatures.tsv',j['harmonized']['rows']),('source_reference_coverage.tsv',refs['rows'])]:
 with (data/filename).open() as f:rows=list(csv.DictReader(f,delimiter='\t'))
 assert rows==[{k:str(v) for k,v in row.items()} for row in json_rows],filename
for name in ['Figure_2_comparison','Figure_3_evidence','Figure_S2_measurement_audit','Figure_S3_pair_coverage','TIGER_Native_Evidence_Coverage']:
 assert (data/(name+'.pdf')).read_bytes().startswith(b'%PDF')
 assert '<svg' in (data/(name+'.svg')).read_text()
assert (data/'TIGER_Harmonized_Comparison.pdf').read_bytes().startswith(b'%PDF')
print('PASS: sequence/pairing identities, source-row scopes, revised signatures, reference reconciliation, matching TSV downloads and figures.')
