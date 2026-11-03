"""Check the published comparison's set identities, scopes and evidence totals."""
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
data=root/'frontend/static/comparison/20261104'
j=json.loads((data/'comparison.json').read_text())
assert j['status']=='COMPLETE'
assert j['snapshot_date']=='2026-11-04'
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
for name in ['Figure_2_comparison','Figure_3_evidence','Figure_S2_measurement_audit','Figure_S3_pair_coverage']:
 assert (data/(name+'.pdf')).read_bytes().startswith(b'%PDF')
 assert '<svg' in (data/(name+'.svg')).read_text()
print('PASS: sequence-set identities, evidence scopes, heatmap totals and figure files.')
