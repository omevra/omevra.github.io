/* Ask Omevra — static retrieval over the site's own library.
   No external calls and no key: answers come only from ask-index.json,
   which is built from this site's pages. Out-of-corpus questions get
   the plain decline. */
(function (root) {
  "use strict";
  var DECLINE = "That's outside what this site documents.";
  var STOP = {a:1, an:1, the:1, is:1, are:1, was:1, were:1, do:1, does:1, did:1,
    what:1, how:1, why:1, when:1, where:1, which:1, who:1, can:1, could:1,
    i:1, me:1, my:1, you:1, your:1, it:1, its:1, of:1, on:1, in:1, to:1,
    for:1, and:1, or:1, with:1, about:1, tell:1, explain:1, please:1, this:1, that:1};
  function tokenize(s) {
    var m = String(s).toLowerCase().match(/[a-z0-9]+(?:[./][a-z0-9]+)*/g) || [];
    return m.filter(function (t) { return !STOP[t]; });
  }
  function scoreChunk(chunk, qtokens, qraw) {
    var score = 0, kwHits = 0, i, j, toks;
    var kwTokens = {};
    for (i = 0; i < chunk.keywords.length; i++) {
      var kw = chunk.keywords[i].toLowerCase();
      if (kw.length > 3 && qraw.indexOf(kw) !== -1) { score += 8; kwHits++; }
      toks = tokenize(kw);
      for (j = 0; j < toks.length; j++) kwTokens[toks[j]] = 1;
    }
    var titleTokens = {};
    toks = tokenize(chunk.title);
    for (j = 0; j < toks.length; j++) titleTokens[toks[j]] = 1;
    var ansTokens = {};
    toks = tokenize(chunk.answer);
    for (j = 0; j < toks.length; j++) ansTokens[toks[j]] = 1;
    var seen = {}, ansHits = 0;
    for (i = 0; i < qtokens.length; i++) {
      var t = qtokens[i];
      if (seen[t]) continue; seen[t] = 1;
      if (kwTokens[t]) { score += 5; kwHits++; }
      else if (titleTokens[t]) score += 3;
      else if (ansTokens[t] && ansHits < 3) { score += 1; ansHits++; }
    }
    return [score, kwHits];
  }
  function answerQuestion(index, question) {
    var qraw = String(question).toLowerCase();
    var qtokens = tokenize(question);
    var best = null, bestScore = 0;
    for (var i = 0; i < index.chunks.length; i++) {
      var sc = scoreChunk(index.chunks[i], qtokens, qraw);
      if (sc[0] > bestScore) { bestScore = sc[0]; best = index.chunks[i]; best._kw = sc[1]; }
    }
    if (!best || bestScore < 5 || !best._kw) return { declined: true, text: index.decline || DECLINE };
    return { declined: false, text: best.answer, sourceTitle: best.title, sourceUrl: best.source, score: bestScore };
  }
  root.EvidraAsk = { answerQuestion: answerQuestion, tokenize: tokenize, DECLINE: DECLINE };
  if (typeof module !== "undefined" && module.exports) { module.exports = root.EvidraAsk; }
  if (typeof document === "undefined") return;
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("ask-evidra");
    if (!box) return;
    var panel = box.querySelector(".ask-panel");
    var msgs = box.querySelector(".ask-msgs");
    var input = box.querySelector(".ask-input");
    var form = box.querySelector(".ask-form");
    var index = null;
    fetch("/assets/ask-index.json").then(function (r) { return r.json(); }).then(function (j) { index = j; });
    box.querySelector(".ask-toggle").addEventListener("click", function () {
      var open = panel.style.display === "block";
      panel.style.display = open ? "none" : "block";
      if (!open) input.focus();
    });
    function addMsg(cls, text) {
      var d = document.createElement("div");
      d.className = "ask-msg " + cls; d.textContent = text; msgs.appendChild(d);
      msgs.scrollTop = msgs.scrollHeight; return d;
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = input.value.trim(); if (!q) return;
      addMsg("ask-q", q); input.value = "";
      if (!index) { addMsg("ask-a", DECLINE); return; }
      var res = answerQuestion(index, q);
      addMsg("ask-a", res.text);
      if (!res.declined) {
        var s = document.createElement("div");
        s.className = "ask-src";
        var a = document.createElement("a");
        a.href = res.sourceUrl; a.textContent = res.sourceTitle;
        s.appendChild(document.createTextNode("Source: ")); s.appendChild(a);
        msgs.appendChild(s); msgs.scrollTop = msgs.scrollHeight;
      }
    });
  });
})(typeof window !== "undefined" ? window : globalThis);
