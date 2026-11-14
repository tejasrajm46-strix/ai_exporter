/* Build the comprehensive artefact conversation inside a real browser. The
   exporter needs Canvas for images and DOM APIs for MathML, so this page is
   the only honest place to call it. tools/generate-artifacts.js reads the
   structured result and writes the files. */
(function () {
  "use strict";

  function paint(kind, type) {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 405;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable; artefacts cannot be generated.");
    if (kind !== "transparent") {
      ctx.fillStyle = "#f7f4ee";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (kind === "diagram") {
      const boxes = [
        { x: 40, y: 150, w: 170, h: 90, label: "parse" },
        { x: 275, y: 70, w: 170, h: 90, label: "normalise" },
        { x: 275, y: 230, w: 170, h: 90, label: "render" },
        { x: 510, y: 150, w: 170, h: 90, label: "export" }
      ];
      ctx.strokeStyle = "#2f4a63";
      ctx.lineWidth = 3;
      ctx.fillStyle = "#ffffff";
      for (const box of boxes) {
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#17324d";
        ctx.font = "600 22px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(box.label, box.x + box.w / 2, box.y + box.h / 2 + 8);
        ctx.fillStyle = "#ffffff";
      }
      ctx.strokeStyle = "#a34054";
      ctx.beginPath();
      ctx.moveTo(210, 195); ctx.lineTo(275, 115); ctx.lineTo(275, 275);
      ctx.moveTo(445, 115); ctx.lineTo(510, 195); ctx.lineTo(445, 275);
      ctx.stroke();
    } else if (kind === "chart") {
      const values = [42, 68, 51, 84, 73, 96, 61];
      const labels = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"];
      ctx.fillStyle = "#17324d";
      ctx.font = "600 20px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("Exported pages per week", 36, 48);
      for (let index = 0; index < values.length; index += 1) {
        const height = values[index] * 2.7;
        const x = 56 + index * 90;
        ctx.fillStyle = index % 2 ? "#a34054" : "#2f4a63";
        ctx.fillRect(x, 340 - height, 54, height);
        ctx.fillStyle = "#17324d";
        ctx.font = "500 17px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(labels[index], x + 27, 368);
      }
    } else if (kind === "webp") {
      const gradient = ctx.createLinearGradient(0, 0, 720, 405);
      gradient.addColorStop(0, "#2f4a63");
      gradient.addColorStop(1, "#a34054");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 720, 405);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(530, 120, 62, 0, Math.PI * 2);
      ctx.arc(620, 250, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 40px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("WebP asset", 44, 216);
    } else {
      // Transparent mark: it must stay transparent in every exporter.
      ctx.fillStyle = "rgba(47,74,99,0.92)";
      ctx.beginPath();
      ctx.arc(360, 200, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "700 92px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("A", 360, 234);
    }
    return canvas.toDataURL(type, 0.92);
  }

  const python = [
    "from dataclasses import dataclass",
    "",
    "@dataclass",
    "class Fraction:",
    "    numerator: int",
    "    denominator: int",
    "",
    "    def value(self) -> float:",
    "        if self.denominator == 0:",
    "            raise ZeroDivisionError(\"denominator must not be zero\")",
    "        return self.numerator / self.denominator",
    "",
    "def simplify(part: Fraction) -> Fraction:",
    "    common = math.gcd(part.numerator, part.denominator)",
    "    return Fraction(part.numerator // common, part.denominator // common)",
    "",
    "print(simplify(Fraction(12, 18)).value())"
  ].join("\n");

  const javascript = [
    "const values = [3, 1, 4, 1, 5, 9, 2, 6];",
    "",
    "function runningTotal(list) {",
    "  return list.reduce((total, value, index) => {",
    "    const next = total + value;",
    "    console.log(\"step \" + (index + 1) + \": \" + next);",
    "    return next;",
    "  }, 0);",
    "}",
    "",
    "console.log(runningTotal(values));"
  ].join("\n");

  const cpp = [
    "#include <iostream>",
    "#include <vector>",
    "",
    "int main() {",
    "    std::vector<int> values{10, 20, 30};",
    "\tfor (int value : values) {",
    "\t\tstd::cout << value << \" \";",
    "\t}",
    "",
    "    const long long total = 10 + 20 + 30;",
    "    std::cout << \"\\ntotal: \" << total << std::endl;",
    "    return 0;",
    "}"
  ].join("\n");

  const bash = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "for file in tests/output/*.pdf; do",
    "    pages=$(pdfinfo \"$file\" | awk '/^Pages/ {print $2}')",
    "    printf '%s -> %s pages\\n' \"$file\" \"$pages\"",
    "done"
  ].join("\n");

  const sql = [
    "SELECT m.role,",
    "       COUNT(*) AS blocks,",
    "       MAX(LENGTH(b.text)) AS longest",
    "FROM messages AS m",
    "JOIN blocks AS b ON b.message_id = m.id",
    "WHERE m.exported_at >= DATE '2026-01-01'",
    "GROUP BY m.role",
    "ORDER BY blocks DESC;"
  ].join("\n");

  const jsonCode = [
    "{",
    "  \"name\": \"café notes\",",
    "  \"version\": 1,",
    "  \"formats\": [\"pdf\", \"docx\", \"markdown\", \"txt\", \"json\", \"html\", \"png\"],",
    "  \"limits\": { \"side\": 16384, \"pixels\": 16777216 }",
    "}"
  ].join("\n");

  const htmlCode = [
    "<section class=\"callout callout--note\">",
    "  <h3>Note</h3>",
    "  <p>Markup in the source stays text, never becomes an element.</p>",
    "</section>"
  ].join("\n");

  const cssCode = [
    ".document {",
    "  max-width: 190mm;",
    "  margin: 0 auto;",
    "  font-family: \"Source Serif 4\", Georgia, serif;",
    "}",
    "",
    "@media print {",
    "  .document { break-inside: auto; }",
    "  thead { display: table-header-group; }",
    "}"
  ].join("\n");

  const rust = [
    "fn gcd(mut a: u64, mut b: u64) -> u64 {",
    "    while b != 0 {",
    "        let remainder = a % b;",
    "        a = b;",
    "        b = remainder;",
    "    }",
    "    a",
    "}",
    "",
    "fn main() {",
    "    println!(\"{}\", gcd(12, 18));",
    "}"
  ].join("\n");

  const go = [
    "package main",
    "",
    "import \"fmt\"",
    "",
    "func main() {",
    "\tvalues := []int{10, 20, 30}",
    "\ttotal := 0",
    "\tfor _, value := range values {",
    "\t\ttotal += value",
    "\t}",
    "\tfmt.Println(total)",
    "}"
  ].join("\n");

  const java = [
    "public final class ArraySum {",
    "    private ArraySum() {}",
    "",
    "    public static int total(int[] values) {",
    "        int sum = 0;",
    "        for (int value : values) {",
    "            sum += value;",
    "        }",
    "        return sum;",
    "    }",
    "",
    "    public static void main(String[] args) {",
    "        System.out.println(total(new int[] {10, 20, 30}));",
    "    }",
    "}"
  ].join("\n");

  const typescript = [
    "type Block = { type: string; text?: string };",
    "",
    "function words(blocks: Block[]): number {",
    "  return blocks.reduce((total, block) => {",
    "    return total + (block.text ? block.text.split(/\\s+/).length : 0);",
    "  }, 0);",
    "}",
    "",
    "console.log(words([{ type: \"paragraph\", text: \"three short words\" }]));"
  ].join("\n");

  const output = "10 20 30\ntotal: 60";

  const longPath = "https://example.com/reference/" + "very-long-path-segment-".repeat(12) + "notes";

  const tableChat = {
    version: 1,
    title: "Long table — repeated header check",
    platform: "chatgpt",
    platformLabel: "ChatGPT",
    model: "Artifact fixture",
    exportedAt: "2026-11-13T09:00:00Z",
    url: "https://chatgpt.com/c/artifact-table",
    messages: [{
      id: "table-answer",
      role: "assistant",
      text: "A long table that spans more than one printed page.",
      blocks: [
        { type: "heading", level: 2, text: "Step-by-step table" },
        { type: "paragraph", text: "The header row must repeat on every printed page. Each row is deliberately long enough to push the table across a page boundary." },
        { type: "table", head: ["Step", "Expression", "Result", "Note"], rows: Array.from({ length: 70 }, (_, index) => [
          String(index + 1),
          `step_${index + 1}(x) = x^${index % 9} + ${index + 1}`,
          `value ${index * 3 + 1}`,
          index % 7 === 0 ? "A note long enough to wrap inside its cell without touching the neighbouring column." : "—"
        ]) }
      ]
    }]
  };

  async function base64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let at = 0; at < bytes.length; at += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    }
    return btoa(binary);
  }

  globalThis.__generateArtifacts = async function generateArtifacts() {
    const png = paint("diagram", "image/png");
    const jpeg = paint("chart", "image/jpeg");
    const webp = paint("webp", "image/webp");
    const transparent = paint("transparent", "image/png");

    const chat = {
      version: 1,
      title: "Fractions, roots and matrices — a complete export fixture",
      platform: "chatgpt",
      platformLabel: "ChatGPT",
      model: "Artifact fixture",
      exportedAt: "2026-11-13T09:00:00Z",
      url: "https://chatgpt.com/c/artifact-fixture",
      messages: [
        {
          id: "artifact-user-1",
          role: "user",
          text: "Can you walk me through fractions, roots, sums and matrices? Include code and a comparison table.",
          blocks: [{
            type: "paragraph",
            text: "Can you walk me through fractions, roots, sums and matrices — starting from $\\frac{a}{b}$ and $\\sqrt{x+1}$? Include code and a comparison table."
          }]
        },
        {
          id: "artifact-assistant-1",
          role: "assistant",
          timestamp: "2026-11-13T09:00:12Z",
          text: "Complete walkthrough with mathematics, tables, code and figures.",
          blocks: [
            { type: "heading", level: 2, text: "1. Fractions and roots" },
            { type: "paragraph", text: "A fraction is a division written vertically. The same value appears inline as $\\frac{a}{b}$ and as a display equation. **Bold**, *italic*, `inline code` and a [reference link](https://example.com/docs) must all survive the export." },
            /* Regression surface: a price next to a formula, an escaped price and
               an empty formula all used to damage the sentence around them. */
            { type: "paragraph", text: "Prices beside mathematics: it costs $5 for $x^2$ units and \\$10 for the rest." },
            { type: "paragraph", text: "An empty formula $$ $$ is not a failure." },
            { type: "formula", tex: "\\frac{a}{b}" },
            { type: "formula", tex: "\\frac{1}{\\frac{a}{b}}" },
            { type: "formula", tex: "\\sqrt{x+1}" },
            { type: "formula", tex: "\\sqrt[3]{x}" },
            { type: "formula", tex: "x^{n+1}" },
            { type: "formula", tex: "a_{ij}" },
            { type: "formula", tex: "\\frac{x^2+1}{x-1}" },

            { type: "heading", level: 2, text: "2. Sums, integrals and limits" },
            { type: "formula", tex: "\\sum_{i=1}^{n} i" },
            { type: "formula", tex: "\\int_0^1 x^2\\,dx" },
            { type: "formula", tex: "\\lim_{x\\to 0}\\frac{\\sin x}{x}" },
            { type: "formula", tex: "\\sin x" },
            { type: "formula", tex: "x % this comment must never reach the document" },

            { type: "heading", level: 2, text: "3. Matrices and set-builder notation" },
            { type: "formula", tex: "\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}" },
            { type: "formula", tex: "a+H=\\{a+h:h\\in H\\}" },
            { type: "formula", tex: "\\begin{cases} x^2 & x \\ge 0 \\\\ -x & x < 0 \\end{cases}" },
            { type: "formula", tex: "\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\\\ (a-b)^2 &= a^2 - 2ab + b^2 \\end{aligned}" },
            { type: "formula", tex: "\\binom{5}{2} = 10, \\quad \\boxed{2^{-1}=8} \\pmod{15}" },

            { type: "heading", level: 3, text: "Nested steps" },
            { type: "list", ordered: false, items: [
              "Read the expression from the outside in.",
              "Resolve the innermost fraction first.",
              "Apply the root or exponent.",
              "Check the result against a numeric estimate."
            ], depths: [0, 1, 1, 0], orders: [false, true, true, false] },

            { type: "heading", level: 3, text: "Comparison" },
            { type: "table", head: ["Concept", "Meaning"], rows: [
              ["Fraction", "A quotient of two expressions."],
              ["Root", "The inverse of an exponent."],
              ["Limit", "The value a sequence approaches."]
            ] },
            { type: "table", head: ["Operation", "Example", "Cost"], rows: [
              ["Read", "values[1]", "O(1)"],
              ["Traverse", "for each value", "O(n)"],
              ["Long reference", longPath, "Wrap inside the cell, never overlap the next column"]
            ] },
            { type: "table", head: ["n", "n²", "√n", "2ⁿ", "n!"], rows: [
              ["1", "1", "1.000", "2", "1"],
              ["2", "4", "1.414", "4", "2"],
              ["3", "9", "1.732", "8", "6"],
              ["4", "16", "2.000", "16", "24"]
            ] },

            { type: "paragraph", text: "Note: every table cell is escaped text. Literal <img src=x onerror=alert(1)> must never become active markup." },
            { type: "paragraph", text: "Warning: printing a very wide table can clip its last column if the page is narrow; use landscape or narrower margins." },
            { type: "quote", text: "Key Takeaway: a formula is readable in every format — MathML in HTML and PDF, OMML in Word, TeX in Markdown, plain words in TXT." },

            { type: "heading", level: 2, text: "4. Code in several languages" },
            { type: "code", language: "python", code: python },
            { type: "code", language: "javascript", code: javascript },
            { type: "code", language: "cpp", code: cpp },
            { type: "paragraph", text: "Output:" },
            { type: "code", language: "text", code: output },
            { type: "code", language: "bash", code: bash },
            { type: "code", language: "sql", code: sql },
            { type: "code", language: "json", code: jsonCode },
            { type: "code", language: "html", code: htmlCode },
            { type: "code", language: "css", code: cssCode },
            { type: "code", language: "rust", code: rust },
            { type: "code", language: "go", code: go },
            { type: "code", language: "java", code: java },
            { type: "code", language: "typescript", code: typescript },

            { type: "heading", level: 2, text: "5. Figures" },
            { type: "image", src: png, alt: "Pipeline diagram: parse, normalise, render, export", caption: "Figure 1: the export pipeline.", kind: "diagram", width: 720, height: 405 },
            { type: "image", src: jpeg, alt: "Bar chart of exported pages per week", caption: "Figure 2: a JPEG chart.", kind: "chart", width: 720, height: 405 },
            { type: "image", src: webp, alt: "Gradient WebP artwork", caption: "Figure 3: WebP is transcoded for Word.", kind: "diagram", width: 720, height: 405 },
            { type: "image", src: transparent, alt: "Transparent circular mark", caption: "Figure 4: transparency preserved in PNG.", kind: "image", width: 720, height: 405 },
            { type: "image", src: "data:image/png;base64,AAAA", alt: "Deliberately broken image bytes", caption: "Figure 5: broken assets are reported, never silently dropped." },
            { type: "image", src: "https://images.invalid/diagram.png", alt: "Remote image blocked by default" },

            { type: "heading", level: 2, text: "6. Practice question" },
            { type: "paragraph", text: "Q1. Which expression is equivalent to $\\frac{x^2-1}{x-1}$ for $x \\neq 1$?" },
            { type: "list", ordered: false, items: ["A. $x-1$", "B. $x+1$", "C. $x^2+1$", "D. $1$"] },

            { type: "footnote", text: "Footnote blocks are not part of the core model; their text is still carried rather than dropped." },
            { type: "divider" },
            { type: "paragraph", text: "A final paragraph with a very long unbroken token, https://example.com/" + "segment".repeat(30) + ", to prove wrapping never widens the page." }
          ]
        },
        {
          id: "artifact-user-2",
          role: "user",
          text: "And the set-builder form?",
          blocks: [{ type: "paragraph", text: "And the set-builder form for a coset, $a+H=\\{a+h:h\\in H\\}$?" }]
        },
        {
          id: "artifact-assistant-2",
          role: "assistant",
          text: "Set-builder notation and a limit, compactly.",
          blocks: [
            { type: "paragraph", text: "Yes — the coset is written $a+H=\\{a+h:h\\in H\\}$ and the limit is $\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$." },
            { type: "formula", tex: "a+H=\\{a+h:h\\in H\\}" },
            { type: "formula", tex: "\\lim_{x\\to 0}\\frac{\\sin x}{x}=1" }
          ]
        }
      ]
    };

    const files = [];
    const push = async (name, format, options = {}, source = chat) => {
      const result = await AIExporter.build(source, format, options);
      const entry = { name, format, mime: result.mime, warnings: result.warnings || [] };
      if (result.text != null) entry.text = result.text;
      else if (result.blob) {
        entry.base64 = await base64(result.blob);
        if (result.blob.pixelWidth) {
          entry.pixelWidth = result.blob.pixelWidth;
          entry.pixelHeight = result.blob.pixelHeight;
          entry.exportScale = result.blob.exportScale;
          entry.requestedScale = result.blob.requestedScale;
        }
      }
      files.push(entry);
      return entry;
    };

    await push("conversation.html", "html", { theme: "light" });
    await push("conversation.md", "markdown", {});
    await push("conversation.txt", "txt", {});
    await push("conversation.docx", "docx", { docMode: "color", pageSize: "a4", orientation: "portrait", margin: "normal" });
    await push("conversation.png", "image", { imageQuality: "high", theme: "light" });
    await push("conversation.json", "json", {});
    await push("table-headers.docx", "docx", { docMode: "color", pageSize: "a4", orientation: "portrait", margin: "normal" }, tableChat);

    const pdfSources = [
      { name: "conversation-a4-portrait-normal", html: AIExporter.documentHtml(chat, { pageSize: "a4", orientation: "portrait", margin: "normal", theme: "light" }) },
      { name: "conversation-letter-landscape-narrow", html: AIExporter.documentHtml(chat, { pageSize: "letter", orientation: "landscape", margin: "narrow", theme: "light" }) },
      { name: "conversation-a4-portrait-wide", html: AIExporter.documentHtml(chat, { pageSize: "a4", orientation: "portrait", margin: "wide", theme: "print" }) },
      { name: "conversation-a4-cover", html: AIExporter.documentHtml(chat, { pageSize: "a4", orientation: "portrait", margin: "normal", theme: "light", includeCover: true }) },
      { name: "table-headers", html: AIExporter.documentHtml(tableChat, { pageSize: "a4", orientation: "portrait", margin: "normal", theme: "light" }) }
    ];
    const htmlVariants = [
      { name: "theme-dark", html: AIExporter.documentHtml(chat, { pageSize: "a4", orientation: "portrait", margin: "normal", theme: "dark" }) },
      { name: "theme-print", html: AIExporter.documentHtml(chat, { pageSize: "a4", orientation: "portrait", margin: "normal", theme: "print" }) }
    ];

    return {
      files,
      pdfSources,
      htmlVariants,
      tableChat,
      validation: AIExporter.validateChat(chat),
      summary: {
        messages: chat.messages.length,
        blocks: chat.messages.reduce((total, message) => total + message.blocks.length, 0),
        formulas: chat.messages.reduce((total, message) => total + message.blocks.filter((block) => block.type === "formula").length, 0),
        images: chat.messages.reduce((total, message) => total + message.blocks.filter((block) => block.type === "image").length, 0),
        codeBlocks: chat.messages.reduce((total, message) => total + message.blocks.filter((block) => block.type === "code").length, 0),
        tables: chat.messages.reduce((total, message) => total + message.blocks.filter((block) => block.type === "table").length, 0)
      }
    };
  };
})();
