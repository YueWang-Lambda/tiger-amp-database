import {unpack} from './query-engine.mjs';

export async function gunzip(bytes) {
  if(bytes[0]!==31 || bytes[1]!==139)return bytes;
  if (typeof DecompressionStream!=='undefined') return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const {gunzipSync}=await import('./vendor/fflate.mjs');
  return gunzipSync(bytes);
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export class DataProvider {
  constructor(base,lock,progress=()=>{}) {this.base=new URL(base);this.lock=lock;this.progress=progress;this.cache=new Map();}
  async start() {
    const bytes=await this.fetchBytes('manifest.json');
    if(await sha256(bytes)!==this.lock.manifest_sha256)throw new Error('The release manifest changed. Reload to select one complete release.');
    this.manifest=JSON.parse(new TextDecoder().decode(bytes));
    if(this.manifest.release_id!==this.lock.release_id)throw new Error('Release mismatch');
    return this.manifest;
  }
  async fetchBytes(path,entry) {
    this.progress('Loading records…');
    const response=await fetch(new URL(path,this.base),{cache:'default'});
    if(!response.ok)throw new Error('Data file could not load ('+response.status+'). Please retry.');
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(entry) {
      const hash=await sha256(bytes),compressed=bytes.byteLength===entry.bytes && hash===entry.sha256;
      const decoded=entry.raw_sha256 && bytes.byteLength===entry.raw_bytes && hash===entry.raw_sha256;
      if(!compressed && !decoded)throw new Error('Data integrity check failed. Reload to retry.');
    }
    return bytes;
  }
  async json(entry) {
    if(this.cache.has(entry.path)){const x=this.cache.get(entry.path);this.cache.delete(entry.path);this.cache.set(entry.path,x);return x;}
    let bytes=await this.fetchBytes(entry.path,entry);
    if(bytes[0]===31 && bytes[1]===139)bytes=await gunzip(bytes);
    const value=JSON.parse(new TextDecoder().decode(bytes));
    this.cache.set(entry.path,value);
    while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);
    return value;
  }
  async dataset(name) {
    const entry=this.manifest.datasets[name];if(!entry)throw new Error('Unknown dataset '+name);
    const rows=[];
    for(const part of entry.parts)for(const row of unpack(await this.json(part)))rows.push(row);
    if(rows.length!==entry.rows)throw new Error('Dataset row count mismatch');
    return rows;
  }
  async detail(kind,pid,bucket) {
    const parts=this.manifest.details[kind]?.chunks[String(bucket)]||[],rows=[];
    for(const part of parts)for(const row of (await this.json(part)).groups[pid]||[])rows.push(row);
    return rows;
  }
}
