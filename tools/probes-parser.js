const html = '<div data-message-author-role="assistant"><ul><li>Outer one<ul><li>Inner one</li><li>Inner two<ol><li>Deep</li></ol></li></ul></li><li>Outer two</li></ul><table><tr><td>H1</td><td>H2</td></tr><tr><td>a</td><td>b</td></tr></table><p>Text with **bold** and *star* and `tick`.</p></div>';
const doc = new DOMParser().parseFromString(html, "text/html");
const parsed = AIExporterParser.parsePage(doc, { hostname: "chatgpt.com", href: "https://chatgpt.com/c/x" });
return JSON.stringify(parsed.messages[0].blocks, null, 2);
