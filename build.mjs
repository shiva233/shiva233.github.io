import {readFileSync, writeFileSync} from 'node:fs';
const data = JSON.parse(readFileSync(new URL('src/content.json', import.meta.url)));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const template = readFileSync(new URL('src/template.html', import.meta.url), 'utf8');
const html = template.replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
  const value = data[key.toLowerCase()];
  if (!value) throw new Error(`Missing contact link: ${key}`);
  return escape(value);
});
writeFileSync(new URL('index.html', import.meta.url), html);
console.log('Built PCB business card and contact links.');
