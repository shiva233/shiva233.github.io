import {readFileSync, writeFileSync} from 'node:fs';
const data = JSON.parse(readFileSync(new URL('src/content.json', import.meta.url)));
const esc = x => String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const link = ({label,url}) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
const projects = data.projects.map((p,i) => `<article class="project" id="${p.id}">
  <div class="project-copy"><div class="eyebrow">${String(i+1).padStart(2,'0')} / ${esc(p.category)}</div>
    <h3>${esc(p.name)}</h3>
    <p class="description">${esc(p.description)}</p><ul class="project-details">${p.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <ul class="tags" aria-label="Technologies">${p.tags.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <div class="project-links">${p.links.map(link).join('')}</div>
  </div>
  <figure class="gallery" data-gallery="${esc(p.id)}">
    <button class="gallery-open" aria-label="Enlarge ${esc(p.name)} image"><img src="assets/${esc(p.images[0].src)}" alt="${esc(p.images[0].alt)}" loading="lazy" width="1000" height="760" class="${p.images[0].fit}" data-main-image><span class="enlarge" aria-hidden="true">↗</span></button>
    <figcaption><span data-caption>${esc(p.images[0].caption)}</span><span class="gallery-nav"><button data-prev aria-label="Previous ${esc(p.name)} image">←</button><span data-counter aria-live="polite">01 / ${String(p.images.length).padStart(2,'0')}</span><button data-next aria-label="Next ${esc(p.name)} image">→</button></span></figcaption>
    <div class="thumbnails" aria-label="${esc(p.name)} images">${p.images.map((im,j)=>`<button data-image="${j}" aria-label="Show ${esc(im.caption)}" aria-pressed="${j===0}"><img src="assets/${esc(im.src)}" alt="" loading="lazy" width="90" height="66"></button>`).join('')}</div>
  </figure>
</article>`).join('\n');
let html=readFileSync(new URL('src/template.html',import.meta.url),'utf8').replace('<!-- PROJECTS -->',projects).replaceAll('{{EMAIL}}',esc(data.email)).replaceAll('{{LINKEDIN}}',esc(data.linkedin));
html=html.replace('<!-- X_LINK -->',data.x?link({label:'X',url:data.x}):'');
html=html.replace('<!-- GALLERY_DATA -->',`<script id="gallery-data" type="application/json">${JSON.stringify(data.projects.map(({id,images,name})=>({id,images,name}))).replaceAll('<','\\u003c')}</script>`);
writeFileSync(new URL('index.html',import.meta.url),html);
console.log(`Built portfolio: ${data.projects.length} projects, ${data.projects.reduce((s,p)=>s+p.images.length,0)} original images.`);
