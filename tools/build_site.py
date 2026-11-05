"""Build a subpath-safe static site using public release files and frozen templates."""
import argparse,json,re,shutil,hashlib
from pathlib import Path
from urllib.parse import urlencode,quote,urlsplit,parse_qs
from types import SimpleNamespace
from jinja2 import Environment,FileSystemLoader,select_autoescape
from markupsafe import Markup,escape
from bs4 import BeautifulSoup
from common import PROJECT,digest

def build(base,output=None):
    assert base.startswith('/') and base.endswith('/') and '..' not in base
    front=PROJECT/'frontend';lock=json.loads((PROJECT/'release-lock.json').read_text());release=lock['release_id']
    data=PROJECT/'public-data'/release;manifest=json.loads((data/'manifest.json').read_text())
    assert digest(data/'manifest.json')==lock['manifest_sha256']
    assert all(k in manifest['details'] for k in ('identity','measurements','safety','observations','references'))
    assert 'structures' in manifest['completed'] and len(manifest['downloads'])==4
    out=Path(output).resolve() if output else PROJECT/'dist';out.mkdir(parents=True,exist_ok=True)
    data_parent=out/'data'
    if data_parent.exists():assert {p.name for p in data_parent.iterdir() if p.is_dir()}<={release},'Use a clean output directory for another release'
    ui_hasher=hashlib.sha256()
    ui_hasher.update(Path(__file__).read_bytes())
    for file in sorted(p for p in front.rglob('*') if p.is_file() and p.suffix!='.tgz'):
        ui_hasher.update(file.relative_to(front).as_posix().encode()+b'\0');ui_hasher.update(file.read_bytes())
    ui_revision=ui_hasher.hexdigest()[:16];app_path='app/'+ui_revision
    shutil.copytree(front/'static',out/'static',dirs_exist_ok=True)
    shutil.copytree(data,out/'data'/release,dirs_exist_ok=True)
    # Give every public download the current product name. Keep the pinned
    # release immutable: these byte-identical aliases retain its checksums.
    download_entries={}
    download_dir=out/'downloads';download_dir.mkdir(exist_ok=True)
    for key,entry in {**manifest['downloads'],**manifest['supplementary']}.items():
        name=Path(entry['path']).name
        name='tiger_'+re.sub(r'(?i)^apexd_', '', name)
        name=name.replace('_v2.', '.')
        target=download_dir/name
        assert name not in {e['filename'] for e in download_entries.values()},name
        shutil.copyfile(data/entry['path'],target)
        assert digest(target)==entry['sha256'],name
        download_entries[key]={**entry,'filename':name,'path':'downloads/'+name,'source_path_in_release':entry['path']}
    (download_dir/'manifest.json').write_text(json.dumps({'release_id':release,'files':download_entries},indent=2)+'\n')
    (out/app_path).mkdir(parents=True,exist_ok=True)
    for file in front.glob('*.mjs'):shutil.copyfile(file,out/app_path/file.name)
    shutil.copyfile(front/'static-site.css',out/app_path/'static-site.css')
    shutil.copytree(front/'vendor',out/app_path/'vendor',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.tgz'))
    loader=out/'static/js/apexd-observatory-loader.js'
    loader.write_text(loader.read_text().replace("'/static/js/","'"+base+'static/js/'))
    env=Environment(loader=FileSystemLoader(front/'templates'),autoescape=select_autoescape(['html']))
    env.filters['number']=lambda x:f'{x:,}'
    env.filters['sequence_marks']=lambda x:Markup(re.sub(r'([XJ])',r'<mark title="Ambiguous residue">\1</mark>',str(escape(x))))
    env.globals.update(query_url=lambda **kw:'/search?'+urlencode({k:v for k,v in kw.items() if v not in (None,'')}),article_url=lambda doi:'/article/'+quote(doi,safe=''),parameter_url=lambda path,params,**kw:path+'?'+urlencode({k:v for k,v in {**params,**kw}.items() if v not in (None,'',[])},doseq=True))
    context=json.loads((front/'presentation.json').read_text())
    env.globals.update({k:v for k,v in context.items() if k.startswith('brand_')})
    def route(url):
        if not url.startswith('/') or url.startswith('//'):return url
        if base!='/' and url.startswith(base):return url
        u=urlsplit(url);path=u.path;query=u.query
        if path.startswith('/peptide/'):path='/peptide/';query='id='+quote(u.path[len('/peptide/'):],safe='')+('&'+query if query else '')
        elif path.startswith('/article/'):path='/article/';query='key='+u.path[len('/article/'):]+('&'+query if query else '')
        elif path.startswith('/download/collection/'):
            dataset=path.split('/')[-1];path='/download/';query='dataset='+dataset
        elif path.startswith('/api/') or path=='/export':path='/download/';query='';
        elif path=='/statistics' and parse_qs(query).get('unit')==['uM']:path='/statistics/uM/';query=''
        elif not path.startswith(('/static/','/data/','/app/')) and not path.endswith('/'):path+='/'
        return base+path.lstrip('/')+('?' +query if query else '')+('#'+u.fragment if u.fragment else '')
    def render(name,target,active,**extra):
        ctx={**context,'request':SimpleNamespace(url=SimpleNamespace(path='/'+extra.get('view',active))),'active':active,'unit':'ug','query':'','parameters':{},'items':[],'total':0,'page':1,'pages':1,'direct_record':None,**extra}
        html=env.get_template(name).render(**ctx)
        soup=BeautifulSoup(html,'html.parser')
        policy=soup.new_tag('meta',attrs={'http-equiv':'Content-Security-Policy','content':"default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'"})
        soup.head.insert(1,policy)
        for tag in soup.find_all(True):
            for attr in ('href','src','action'):
                if tag.has_attr(attr):tag[attr]=route(tag[attr])
        # Update the public product surface to file-based access.
        for t in soup.find_all(string=True):
            if t.parent.name in ('script','style'):continue
            value=str(t).replace('Downloads & API','Downloads & data').replace('Datasets & API','Datasets & data').replace('detail API','record view').replace('API v1 retains legacy single-row fields;','Historical source cells retain single-row fields;')
            if value!=str(t):t.replace_with(value)
        for meta_name,value in [('tiger-base',base),('tiger-release',release),('tiger-manifest-sha256',lock['manifest_sha256'])]:
            tag=soup.new_tag('meta',attrs={'name':meta_name,'content':value});soup.head.append(tag)
        css=soup.new_tag('link',rel='stylesheet',href=base+app_path+'/static-site.css');soup.head.append(css)
        script=soup.new_tag('script',type='module',src=base+app_path+'/app.mjs');soup.head.append(script)
        status=soup.new_tag('p',id='static-status',attrs={'role':'status','aria-live':'polite'});status['class']='static-status';soup.main.append(status)
        noscript=soup.new_tag('noscript');noscript.string='Enable JavaScript to search and open individual records. Complete CSV datasets remain available from Downloads & data.';soup.main.append(noscript)
        if name=='search.html':
            results=soup.select_one('#search-results');results.clear();results.append(BeautifulSoup('<p class="loading-note">Loading the peptide collection…</p>','html.parser'))
        soup.body['data-static-page']=extra.get('static_page',active)
        (out/target).parent.mkdir(parents=True,exist_ok=True);(out/target).write_text(str(soup))
    render('home.html','index.html','home')
    render('help.html','help/index.html','help')
    render('statistics.html','statistics/index.html','statistics')
    render('statistics.html','statistics/uM/index.html','statistics',unit='uM')
    render('search.html','search/index.html','search')
    for page in ('archive','publications','relations','peptide','article'):
        render('static-dynamic.html',page+'/index.html','search' if page in ('archive','publications','peptide') else '',static_page=page,view=page)
    render('static-download.html','download/index.html','download',manifest=manifest,download_entries=download_entries,download_prefix=base,data_prefix=base+'data/'+release+'/')
    render('static-404.html','404.html','',static_page='not-found')
    (out/'.nojekyll').write_text('')
    (out/'release.json').write_text(json.dumps({**lock,'site_release_id':release+'-'+ui_revision,'ui_revision':ui_revision,'base_path':base,'data':'data/'+release+'/','site_build_date':manifest['site_build_date']},indent=2)+'\n')
    files=[p for p in out.rglob('*') if p.is_file()]
    size=sum(p.stat().st_size for p in files)
    assert size<=850_000_000,('Static site exceeds agreed size budget',size)
    report={'status':'PASS','release_id':release,'site_release_id':release+'-'+ui_revision,'ui_revision':ui_revision,'base_path':base,'files':len(files),'bytes':size,'size_budget_bytes':850_000_000,'main_database_included':False}
    (PROJECT/'reports').mkdir(exist_ok=True);(PROJECT/'reports'/('BUILD_ROOT.json' if base=='/' else 'BUILD.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base-path',default='/tiger-amp-database/');p.add_argument('--output');a=p.parse_args();build(a.base_path,a.output)
