const block = { type: "list", ordered: false, items: ["Outer one", "Inner one", "Inner two", "Deep", "Outer two"], depths: [0, 1, 1, 2, 0], orders: [false, false, false, true, false] };
const sample = { version: 1, title: "t", messages: [{ role: "assistant", blocks: [block] }] };
const html = AIExporter.documentHtml(sample);
const md = AIExporter.markdownFor(sample);
const grouped = globalThis.AIMcq ? globalThis.AIMcq.group([block]) : null;
return JSON.stringify({ hasOuter: html.includes("Outer one"), at: html.indexOf("list"), slice: html.slice(html.indexOf("<section"), html.indexOf("<section") + 1200), md, grouped });
