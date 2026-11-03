"""Fetch and safely extract the exact public data archive pinned for this site."""
import argparse,hashlib,json,shutil,tarfile,urllib.request
from pathlib import Path,PurePosixPath
from common import PROJECT,digest
def fetch(archive=None):
    pin=json.loads((PROJECT/'publication-lock.json').read_text());lock=json.loads((PROJECT/'release-lock.json').read_text())
    target=PROJECT/'public-data'/lock['release_id']
    if target.exists():raise RuntimeError('Data destination already exists. Use a clean checkout for a reproducible rebuild.')
    if archive:source=Path(archive).resolve()
    else:
        source=PROJECT/pin['asset_name'];temporary=source.with_suffix(source.suffix+'.part')
        url='https://github.com/'+pin['repository']+'/releases/download/'+pin['tag']+'/'+pin['asset_name']
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TIGER-static-build'}),timeout=120) as response,temporary.open('wb') as out:shutil.copyfileobj(response,out,1024*1024)
        temporary.replace(source)
    assert digest(source)==pin['archive_sha256'],'Release archive checksum mismatch'
    prefix=PurePosixPath('public-data')/lock['release_id'];total=0
    with tarfile.open(source,'r:gz') as tar:
        for member in tar:
            relative=PurePosixPath(member.name)
            assert not relative.is_absolute() and '..' not in relative.parts and relative.is_relative_to(prefix),member.name
            assert member.isfile(),'Release archives contain regular files only'
            total+=member.size;assert total<=850_000_000,'Unpacked release exceeds size budget'
            destination=PROJECT/relative;destination.parent.mkdir(parents=True,exist_ok=True)
            assert not destination.exists(),member.name
            with tar.extractfile(member) as incoming,destination.open('wb') as out:shutil.copyfileobj(incoming,out,1024*1024)
    assert digest(target/'manifest.json')==lock['manifest_sha256']
    print('Verified public release extracted:',lock['release_id'])
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive');a=p.parse_args();fetch(a.archive)
