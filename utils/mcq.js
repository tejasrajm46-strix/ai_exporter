/* Multiple-choice layout: detection and grouping, no rendering.
 *
 * A conversation can express MCQs in two ways, and both used to end up as one
 * continuous paragraph because the parser collapsed <br> and soft line breaks
 * into spaces. This module restores the structure, but only when it is
 * unambiguous:
 *
 *   1. Separate blocks (parser split the lines, or the page used a list):
 *      a question stem followed by consecutive A, B, C... option blocks.
 *   2. One collapsed block holding "A. ... B. ... C. ..." inline: split only
 *      when three or more markers ascend from A after a sentence boundary and
 *      a real question stem introduces them.
 *
 * Anything else - two options, letters out of order, prose that mentions
 * "option A", a table or a code sample - is passed through untouched. No text
 * is rewritten, shortened or reordered; every string ends up in the document
 * exactly as it was in the conversation.
 */
(function () {
  "use strict";

  /* "A." / "A)" / "A -" / "A·" at the start of a line, with optional bold
     markers around the letter because the parser writes <strong> as **. */
  const OPTION = /^\s*(?:\*\*)?([A-H])(?:\*\*)?\s*[.)\u00b7\u2013\u2014-]\s+(\S[\s\S]*)$/;
  const STEM_PREFIX = /^(?:Q\s*\d+\s*[.):]|Question\s+\d+\s*[.):]|\d+\s*[.)])\s+/i;
  const ANSWER = /^\s*(?:correct\s+)?answer\s*[:\-\u2013\u2014]\s*\S/i;
  const EXPLAIN = /^\s*(?:explanation|why)\s*[:\-\u2013\u2014]\s*\S/i;

  function isParagraph(block) {
    return Boolean(block) && block.type === "paragraph" && typeof block.text === "string";
  }

  /* A question is often written as a heading ("### Q14. ...") with the options
     as ordinary paragraphs. The stem may therefore be either kind of block. */
  function isStemBlock(block) {
    return Boolean(block) &&
      (block.type === "paragraph" || block.type === "heading" || block.type === "subheading") &&
      typeof block.text === "string";
  }

  /** A stem is numbered, or ends like a question. Nothing looser than that. */
  function looksLikeStem(text) {
    const value = String(text == null ? "" : text).trim();
    if (!value) return false;
    if (STEM_PREFIX.test(value)) return true;
    return /[?:]\s*$/.test(value);
  }

  /**
   * One formula written across two source lines is still one formula. Join a
   * line whose $...$ span is still open with the following lines before any
   * line-based splitting happens, or the halves print as raw TeX.
   */
  function foldMath(text) {
    const value = String(text == null ? "" : text);
    if (value.indexOf("$") === -1) return value;
    const lines = value.split(/\r?\n/);
    const joined = [];
    for (let index = 0; index < lines.length; index += 1) {
      let line = lines[index];
      let folded = 0;
      while (((line.match(/\$/g) || []).length % 2 === 1) && index + 1 < lines.length && folded < 3) {
        index += 1;
        line += ` ${lines[index].trim()}`;
        folded += 1;
      }
      joined.push(line);
    }
    return joined.join("\n");
  }

  /**
   * One paragraph with real line breaks becomes one paragraph per line. This is
   * how a document keeps the source's own boundaries: four options written on
   * four lines stay four blocks, whether they arrived as <br>, as sibling
   * divs, or as soft wraps.
   */
  function splitParagraph(block) {
    if (!isParagraph(block) || !/[\r\n]/.test(block.text)) return [block];
    return foldMath(block.text)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ type: "paragraph", text }));
  }

  /**
   * "A. one B. two C. three" collapsed into a single paragraph. Returns the
   * stem and the option lines only when the markers ascend from A and every
   * one of them follows a sentence boundary; the stem may be empty when the
   * question lives in the previous paragraph.
   */
  function explodeInline(text) {
    const starts = [];
    const marker = /(^|[.?!:,]\s+)([A-H])\s*[.)]\s+\S/g;
    let match;
    while ((match = marker.exec(text)) !== null) {
      starts.push({ index: match.index + match[1].length, letter: match[2] });
    }
    if (starts.length < 3 || starts[0].letter !== "A") return null;
    for (let index = 1; index < starts.length; index += 1) {
      if (starts[index].letter.charCodeAt(0) !== 65 + index) return null;
    }
    const options = starts.map((start, index) =>
      text.slice(start.index, index + 1 < starts.length ? starts[index + 1].index : text.length).trim()
    );
    return { stem: text.slice(0, starts[0].index).trim(), options };
  }

  function optionOf(text) {
    const match = OPTION.exec(text);
    return match ? { letter: match[1], text: match[2].trim() } : null;
  }

  /** Options carried by one block: a paragraph, or a list of lettered items. */
  function optionsFrom(block, expected) {
    if (isParagraph(block)) {
      const option = optionOf(block.text);
      return option && option.letter === expected ? [option] : null;
    }
    if (block && block.type === "list" && Array.isArray(block.items) && block.items.length) {
      const base = expected.charCodeAt(0);
      const found = [];
      for (let index = 0; index < block.items.length; index += 1) {
        const option = optionOf(block.items[index]);
        if (!option || option.letter !== String.fromCharCode(base + index)) return null;
        found.push(option);
      }
      return found;
    }
    return null;
  }

  /** A stem plus 3+ sequential options, an optional answer and explanation. */
  function mcqAt(blocks, start) {
    const stem = blocks[start];
    if (!isStemBlock(stem) || !looksLikeStem(stem.text)) return null;
    const options = [];
    let index = start + 1;
    while (index < blocks.length && options.length < 8) {
      const found = optionsFrom(blocks[index], String.fromCharCode(65 + options.length));
      if (!found) break;
      options.push(...found);
      index += 1;
    }
    if (options.length < 3) return null;

    let answer = "";
    let explanation = "";
    if (index < blocks.length && isParagraph(blocks[index]) && ANSWER.test(blocks[index].text)) {
      answer = blocks[index].text;
      index += 1;
    }
    if (index < blocks.length && isParagraph(blocks[index]) && EXPLAIN.test(blocks[index].text)) {
      explanation = blocks[index].text;
      index += 1;
    }
    return {
      block: { type: "mcq", question: stem.text, options, answer, explanation },
      end: index
    };
  }

  /**
   * @param {Array<object>} blocks normalised document blocks
   * @returns {Array<object>} the same blocks with unambiguous MCQs grouped
   */
  function group(blocks) {
    const prepared = [];
    for (const block of blocks || []) prepared.push(...splitParagraph(block));

    /* Expand a collapsed option run into one paragraph per line. The stem is
       either inside the same paragraph or the paragraph just before it. */
    const expanded = [];
    for (const block of prepared) {
      const run = isParagraph(block) ? explodeInline(block.text) : null;
      if (!run) {
        expanded.push(block);
        continue;
      }
      const previous = expanded[expanded.length - 1];
      if (run.stem && looksLikeStem(run.stem)) {
        expanded.push({ type: "paragraph", text: run.stem });
      } else if (run.stem || !isStemBlock(previous) || !looksLikeStem(previous.text)) {
        expanded.push(block);
        continue;
      }
      for (const option of run.options) expanded.push({ type: "paragraph", text: option });
    }

    const out = [];
    for (let index = 0; index < expanded.length; index += 1) {
      const found = mcqAt(expanded, index);
      if (!found) {
        out.push(expanded[index]);
        continue;
      }
      out.push(found.block);
      index = found.end - 1;
    }
    return out;
  }

  globalThis.AIMcq = { group, foldMath };
})();
