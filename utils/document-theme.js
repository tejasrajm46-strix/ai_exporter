/* The document palette: the only owner of colour for exported documents.
 *
 * This is deliberately separate from the extension chrome. export.css,
 * popup.css and content.css carry the product's brand (navy, plum, burgundy,
 * rose, amber, blush) for buttons, cards and selection states; a document is
 * paper, so it gets white (or charcoal) pages, near-black ink, hairline rules
 * and colour only where it carries meaning: a link, an output panel, a
 * warning. Editing the interface palette must never restyle an export, and
 * editing these values must never restyle the extension.
 *
 * The code panel is the one place the two meet by design: a document's code
 * block is the same neutral GitHub-style palette as the studio's code textbox,
 * because that is a convention of code typography, not branding.
 *
 * Loaded before exporter.js and docx.js; both read it, so HTML, print, PNG and
 * Word cannot drift apart again.
 */
(function () {
  "use strict";

  const DOC = {
    light: {
      stage: "#f2f2f3", paper: "#ffffff", ink: "#1f2328", inkSoft: "#3d4348",
      muted: "#5f666d", line: "#e0e3e6", lineStrong: "#c6cbd0",
      accent: "#2f4a63", accentSoft: "#f2f4f6", accentInk: "#1f2328",
      headBg: "#ffffff", headInk: "#1f2328", headIcon: "#5f666d",
      codeBg: "#F3F4F6", codeInk: "#24292F", codeHeadBg: "#E9EBEF",
      codeHeadInk: "#24292F", codeLine: "#D1D5DB", codeLineNo: "#8C959F",
      inlineBg: "#EFF1F3", inlineInk: "#1F2328",
      outBg: "#F6F6F5", outInk: "#1F2328", outHeadBg: "#ECECEA",
      outHeadInk: "#24292F", outLine: "#D9D9D2",
      tokKw: "#8250DF", tokStr: "#116329", tokNum: "#953800",
      tokCom: "#6E7781", tokFn: "#0550AE", tokType: "#0550AE",
      noteBg: "#F7F8F9", noteHeadBg: "#ECEEF0", noteLine: "#C6CBD0",
      noteInk: "#1F2328", noteChip: "#3D4348",
      tipBg: "#F7F8F9", tipHeadBg: "#ECEEF0", tipLine: "#C6CBD0",
      tipInk: "#1F2328", tipChip: "#3D4348",
      warningBg: "#FDF4EF", warningHeadBg: "#F7E1D6", warningLine: "#B4573A",
      warningInk: "#46231A", warningChip: "#46231A",
      tableHead: "#F3F4F5", tableHeadInk: "#1F2328",
      bulletA: "#5F666D", bulletB: "#5F666D"
    },
    dark: {
      stage: "#0f1114", paper: "#17191d", ink: "#e8eaed", inkSoft: "#c9cdd2",
      muted: "#9aa1a8", line: "#2b3036", lineStrong: "#3d434a",
      accent: "#9dc0e0", accentSoft: "#20242a", accentInk: "#e8eaed",
      headBg: "#1c1f24", headInk: "#e8eaed", headIcon: "#9aa1a8",
      codeBg: "#161B22", codeInk: "#E6EDF3", codeHeadBg: "#21262D",
      codeHeadInk: "#E6EDF3", codeLine: "#30363D", codeLineNo: "#6E7681",
      inlineBg: "#262A30", inlineInk: "#E8EAED",
      outBg: "#1D2126", outInk: "#E8EAED", outHeadBg: "#262A30",
      outHeadInk: "#E8EAED", outLine: "#3D434A",
      tokKw: "#D2A8FF", tokStr: "#7EE787", tokNum: "#FFA657",
      tokCom: "#8B949E", tokFn: "#79C0FF", tokType: "#79C0FF",
      noteBg: "#20242A", noteHeadBg: "#272C33", noteLine: "#3D434A",
      noteInk: "#E8EAED", noteChip: "#C9CDD2",
      tipBg: "#20242A", tipHeadBg: "#272C33", tipLine: "#3D434A",
      tipInk: "#E8EAED", tipChip: "#C9CDD2",
      warningBg: "#2E201B", warningHeadBg: "#3D2A22", warningLine: "#A9664B",
      warningInk: "#F6DED4", warningChip: "#F6DED4",
      tableHead: "#23272D", tableHeadInk: "#E8EAED",
      bulletA: "#9AA1A8", bulletB: "#9AA1A8"
    },
    print: {
      stage: "#f2f2f2", paper: "#ffffff", ink: "#111827", inkSoft: "#1f2937",
      muted: "#4b5563", line: "#d1d5db", lineStrong: "#9ca3af",
      accent: "#111827", accentSoft: "#f3f4f6", accentInk: "#111827",
      headBg: "#ffffff", headInk: "#111827", headIcon: "#4b5563",
      codeBg: "#F3F4F6", codeInk: "#111827", codeHeadBg: "#E5E7EB",
      codeHeadInk: "#111827", codeLine: "#9CA3AF", codeLineNo: "#6B7280",
      inlineBg: "#F0F1F2", inlineInk: "#111827",
      outBg: "#F6F6F6", outInk: "#111827", outHeadBg: "#EBEBEB",
      outHeadInk: "#111827", outLine: "#9CA3AF",
      tokKw: "#111827", tokStr: "#111827", tokNum: "#111827",
      tokCom: "#374151", tokFn: "#111827", tokType: "#111827",
      noteBg: "#F7F7F7", noteHeadBg: "#EDEDED", noteLine: "#9CA3AF",
      noteInk: "#111827", noteChip: "#111827",
      tipBg: "#F7F7F7", tipHeadBg: "#EDEDED", tipLine: "#9CA3AF",
      tipInk: "#111827", tipChip: "#111827",
      warningBg: "#F7F7F7", warningHeadBg: "#EBEBEB", warningLine: "#111827",
      warningInk: "#111827", warningChip: "#111827",
      tableHead: "#F3F4F6", tableHeadInk: "#111827",
      bulletA: "#374151", bulletB: "#374151"
    }
  };

  /* Word needs bare hex, and its own two modes: colour (the light document)
     and black and white (the printable document). Deriving them means the
     .docx can never carry a third palette of its own. */
  const bare = (theme) => Object.fromEntries(
    Object.entries(theme).map(([key, value]) => [key, String(value).replace(/^#/, "").toUpperCase()])
  );
  const WORD = { color: bare(DOC.light), bw: bare(DOC.print) };

  const themeFor = (name) => (name === "dark" ? DOC.dark : name === "print" ? DOC.print : DOC.light);
  const wordFor = (mode) => (mode === "bw" ? WORD.bw : WORD.color);

  globalThis.AIDocumentTheme = { DOC, WORD, themeFor, wordFor };
})();
