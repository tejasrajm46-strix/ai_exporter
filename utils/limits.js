/* Document-model limits, in one place.
 *
 * The same rule is applied at three points: the service worker on the handoff,
 * the renderer when it normalises a chat, and the Word writer when it emits
 * numbering. Three copies of "0..8" is how a nested list flattens on one
 * surface and survives on another, so the number lives here and every surface
 * asks for it.
 */
(function () {
  /* Word's numbering model has nine levels, so the document model stops there. */
  const MAX_LIST_DEPTH = 8;

  /** One list depth, clamped to the model's range. */
  function listDepth(value) {
    const depth = Math.floor(Number(value));
    if (!Number.isFinite(depth)) return 0;
    return Math.max(0, Math.min(MAX_LIST_DEPTH, depth));
  }

  /** A depth per item, or null when the array does not describe these items. */
  function listDepths(values, length) {
    if (!Array.isArray(values) || values.length !== length) return null;
    return values.map(listDepth);
  }

  const api = { MAX_LIST_DEPTH, listDepth, listDepths };
  globalThis.AILimits = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
