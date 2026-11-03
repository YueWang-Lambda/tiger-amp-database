"use strict";
(() => {
  const section=document.getElementById('apexd-observatory');
  if(!section)return;
  let loading=false;
  const load=()=>{
    if(loading)return;loading=true;
    section.dataset.modelState='loading';
    document.getElementById('apexd3d-loading').textContent='Preparing the molecular evidence observatory…';
    const script=document.createElement('script');
    script.src='/static/js/apexd-observatory.js?v=08a7442e1d08';
    script.onerror=()=>{
      section.dataset.modelState='unavailable';
      document.getElementById('apexd3d-loading').textContent='The interactive model could not load. Reload the page to try again.';
    };
    document.head.appendChild(script);
  };
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}
    },{rootMargin:'100px 0px',threshold:0});
    observer.observe(section);
  }else load();
})();
