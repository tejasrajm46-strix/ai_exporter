const doc = new DOMParser().parseFromString(`
<div><ul><li>Outer one<ul><li>Inner one</li><li>Inner two<ol><li>Deep</li></ol></li></ul></li><li>Outer two</li></ul>
<table><tr><td>H1</td><td>H2</td></tr><tr><td>a</td><td>b</td></tr></table>
<p>This has **bold** and a single * star and \`tick\`.</p></div>`, "text/html");
const chat = { title: "Probe", platform: "chatgpt", platformLabel: "ChatGPT", model: "m", exportedAt: new Date().toISOString(), url: "https://chatgpt.com/c/x",
  messages: [{ id: "a", role: "assistant", text: "", blocks: [
    { type: "formula", tex: String.raw`\frac{a}{b}` },
    { type: "paragraph", text: "Inline $$x^2$$ maths and $y$ too." }
  ] }] };
const md = AIExporter.markdownFor(chat);
const txt = AIExporter.textFor(chat);
const docxXml = AIExporterDocx.parts(chat, {}).files.find((f) => f.name === "word/document.xml").text;
return {
  list: AIExporter.sectionsFor({ ...chat, messages: [{ id: "b", role: "assistant", blocks: [{ type: "list", ordered: false, items: ["Outer one", "Inner one"] }] }] }).length,
  plainOf: (() => { const block = document.querySelector("p"); return block ? AIExporter.texToPlain("x") : null; })(),
  markdown: md,
  txt: txt,
  docxHasInlineMath: /<m:oMath>/.test(docxXml),
  docxDollar: docxXml.includes("$$")
};
