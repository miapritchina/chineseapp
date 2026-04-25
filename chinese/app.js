(() => {
  "use strict";

  const CHARACTERLESS = "◎";
  const PAGE_SIZE = 60;
  const MAX_RESULTS = 30;
  const MAX_TREE_DEPTH = 5;
  const HAN_RE = /[㐀-鿿豈-﫿]/;
  const SAVED_KEY = "chinese.saved";

  const ROLE_LABEL = {
    iconic: "Iconic",
    meaning: "Meaning",
    sound: "Sound",
    simplified: "Simplified",
    deleted: "Deleted",
    unknown: "Component",
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  const CARD_W = 220;
  const CARD_H = 280;
  const CARD_H_EXPANDED = 380;

  const state = {
    data: null,
    stack: [],
    query: "",
    page: 1,
    strokeCache: new Map(),
    saved: loadSaved(),
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  const home = $("#home");
  const grid = $("#grid");
  const suggestedSection = $("#suggested-section");
  const suggestedShelf = $("#suggested-shelf");
  const savedSection = $("#saved-section");
  const savedShelf = $("#saved-shelf");
  const loadMoreBtn = $("#load-more");
  const resultsRoot = $("#results");
  const modalRoot = $("#modal-root");
  const searchInput = $("#search");
  const emptyState = $("#empty");

  function mkEl(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function normalizePinyin(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  // ---------- saved words ----------

  function loadSaved() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
    } catch {
      /* storage blocked */
    }
  }

  function toggleSaved(word) {
    if (state.saved.has(word)) state.saved.delete(word);
    else state.saved.add(word);
    persistSaved();
  }

  // ---------- data load ----------

  // Fetch words (small, drives the home render) and chars (bigger, only needed
  // when a modal opens) in parallel. `state.charsReady` resolves once the
  // chars file lands so modal/popup rendering can await it on demand.
  function loadData() {
    state.charsReady = (async () => {
      try {
        const resp = await fetch("./data-chars.json", { cache: "no-cache" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (state.data) state.data.chars = json.chars;
        else state.pendingChars = json.chars;
      } catch (err) {
        console.error("chars load failed:", err);
      }
    })();

    return (async () => {
      try {
        const resp = await fetch("./data.json", { cache: "no-cache" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        // Hydrate trimmed word entries: data.json drops simp (== word) and chars
        // (== [...word]) to keep download size down.
        const wordIndex = new Map();
        for (const w of data.words) {
          w.simp = w.word;
          w.chars = [...w.word];
          wordIndex.set(w.word, w);
        }
        data.chars = state.pendingChars || {};
        state.data = data;
        state.wordIndex = wordIndex;
      } catch (err) {
        console.error(err);
        document.body.prepend(
          mkEl("div", { class: "error-banner" }, `Failed to load data.json: ${err.message}`),
        );
      }
    })();
  }

  function findWord(wordKey) {
    return state.wordIndex?.get(wordKey) || null;
  }

  // ---------- search ranking ----------

  function rankResults(query) {
    const q = query.trim();
    if (!q || !state.data) return [];
    const isHan = HAN_RE.test(q);
    const np = normalizePinyin(q);
    const lq = q.toLowerCase();

    const tiered = [];
    for (const w of state.data.words) {
      const sp = w.searchablePinyin || normalizePinyin(w.pinyin);
      let tier = -1;
      if (isHan) {
        if (w.simp === q) tier = 0;
        else if (w.simp.startsWith(q)) tier = 1;
        else if (w.simp.includes(q)) tier = 2;
      } else if (np && sp.startsWith(np)) tier = 1;
      else if (np && sp.includes(np)) tier = 3;
      else if ((w.definitions || []).some((d) => d.toLowerCase().includes(lq))) tier = 4;
      if (tier === -1) continue;
      tiered.push({ w, tier, rank: w.rank ?? 999999 });
    }
    tiered.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
    return tiered.slice(0, MAX_RESULTS).map((x) => x.w);
  }

  // ---------- home rendering ----------

  function buildCard(w) {
    return mkEl(
      "button",
      {
        class: "card",
        type: "button",
        "aria-label": `${w.simp} ${w.pinyin}`,
        onclick: () => openWord(w.word),
      },
      w.hsk != null ? mkEl("div", { class: "hsk-badge" }, `HSK ${w.hsk}`) : null,
      mkEl("div", { class: "char" }, w.simp),
      mkEl("div", { class: "pinyin" }, w.pinyin),
      mkEl("div", { class: "gloss" }, w.definitions?.[0] || ""),
    );
  }

  function buildResultRow(w) {
    return mkEl(
      "button",
      { class: "result-row", type: "button", onclick: () => openWord(w.word) },
      mkEl("div", { class: "r-hanzi" }, w.simp),
      mkEl(
        "div",
        { class: "r-mid" },
        mkEl("div", { class: "r-pinyin" }, w.pinyin),
        mkEl("div", { class: "r-gloss" }, (w.definitions || []).slice(0, 3).join("; ")),
      ),
      w.hsk != null ? mkEl("div", { class: "r-hsk" }, `HSK ${w.hsk}`) : null,
    );
  }

  function renderHome() {
    if (!state.data) return;
    if (state.query.trim()) {
      home.hidden = true;
      renderResults();
      return;
    }
    home.hidden = false;
    resultsRoot.hidden = true;
    if (emptyState) emptyState.hidden = true;
    renderSavedShelf();
    renderSuggestedShelf();
    renderGridPage();
  }

  function renderSavedShelf() {
    savedShelf.replaceChildren();
    const list = [...state.saved];
    if (!list.length) {
      savedSection.hidden = true;
      return;
    }
    savedSection.hidden = false;
    for (const key of list) {
      const w = findWord(key);
      if (w) {
        savedShelf.append(buildCard(w));
        continue;
      }
      // Char-only saved entry — render a minimal card from data.chars
      const c = state.data.chars[key];
      if (c) savedShelf.append(buildCharOnlyCard(key, c));
    }
  }

  function buildCharOnlyCard(charKey, c) {
    return mkEl(
      "button",
      {
        class: "card",
        type: "button",
        "aria-label": `${charKey} ${c.pinyin || ""}`,
        onclick: () => openCharPopup(charKey),
      },
      mkEl("div", { class: "char" }, charKey),
      mkEl("div", { class: "pinyin" }, c.pinyin || ""),
      mkEl("div", { class: "gloss" }, c.definitions?.[0] || ""),
    );
  }

  function renderSuggestedShelf() {
    suggestedShelf.replaceChildren();
    const list = state.data.suggested || [];
    suggestedSection.hidden = list.length === 0;
    for (const word of list) {
      const w = findWord(word);
      if (w) suggestedShelf.append(buildCard(w));
    }
  }

  function renderGridPage() {
    grid.replaceChildren();
    const total = state.data.words.length;
    const upTo = Math.min(state.page * PAGE_SIZE, total);
    for (let i = 0; i < upTo; i++) grid.append(buildCard(state.data.words[i]));
    if (loadMoreBtn) loadMoreBtn.hidden = upTo >= total;
  }

  function renderResults() {
    resultsRoot.hidden = false;
    resultsRoot.replaceChildren();
    const matches = rankResults(state.query);
    if (emptyState) emptyState.hidden = matches.length > 0;
    for (const w of matches) resultsRoot.append(buildResultRow(w));
  }

  // ---------- modal stack ----------

  async function ensureCharsLoaded() {
    if (state.data?.chars && Object.keys(state.data.chars).length > 0) return;
    if (state.charsReady) await state.charsReady;
  }

  async function openWord(word) {
    await ensureCharsLoaded();
    pushEntry({ kind: "word", key: word }, false);
  }

  async function openChar(char) {
    await ensureCharsLoaded();
    pushEntry({ kind: "char", key: char }, false);
  }

  function pushEntry(entry, fromHistory) {
    state.stack.push(entry);
    if (!fromHistory) history.pushState({ stackLen: state.stack.length }, "", locationForEntry(entry));
    renderModal();
  }

  function popEntry(fromHistory) {
    if (state.stack.length === 0) return;
    state.stack.pop();
    if (state.stack.length === 0) {
      closeModal();
      if (!fromHistory && history.state?.stackLen) history.back();
    } else {
      renderModal();
      if (!fromHistory) history.back();
    }
  }

  function closeModal() {
    modalRoot.replaceChildren();
    modalRoot.classList.remove("open");
    modalRoot.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    renderHome();
  }

  function locationForEntry(e) {
    return `#/${e.kind === "word" ? "w" : "c"}/${encodeURIComponent(e.key)}`;
  }

  function parseHash() {
    const m = /^#\/(w|c)\/(.+)$/.exec(location.hash);
    return m ? { kind: m[1] === "w" ? "word" : "char", key: decodeURIComponent(m[2]) } : null;
  }

  // ---------- modal render ----------

  function renderModal() {
    if (state.stack.length === 0) return closeModal();
    const entry = state.stack[state.stack.length - 1];

    modalRoot.replaceChildren();
    modalRoot.classList.add("open");
    modalRoot.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const header = mkEl(
      "div",
      { class: "modal-header" },
      mkEl(
        "button",
        { class: "back-btn", type: "button", onclick: () => popEntry(false) },
        state.stack.length > 1 ? "← Back" : "← Close",
      ),
      renderModalTitle(entry),
      renderStarSlot(entry),
    );

    const body = mkEl("div", { class: "modal-body" });
    const tree = entry.kind === "word"
      ? buildTreeForWord(entry.key)
      : buildTreeForChar(entry.key);
    if (tree) body.append(tree);

    modalRoot.append(header, body);
    modalRoot.scrollTop = 0;
  }

  function renderModalTitle(entry) {
    if (entry.kind === "word") {
      const w = findWord(entry.key);
      return mkEl(
        "h2",
        { class: "modal-title" },
        w ? w.simp : entry.key,
        w ? mkEl("span", { class: "title-pinyin" }, w.pinyin) : null,
      );
    }
    const c = state.data.chars[entry.key];
    return mkEl(
      "h2",
      { class: "modal-title" },
      entry.key,
      c?.pinyin ? mkEl("span", { class: "title-pinyin" }, c.pinyin) : null,
    );
  }

  // ---------- character popup ----------

  let popupWriter = null;
  let popupEl = null;

  async function openCharPopup(char) {
    closePopup();
    await ensureCharsLoaded();
    const c = state.data.chars[char];

    popupEl = mkEl("div", {
      class: "popup-root",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `Details for ${char}`,
    });

    const backdrop = mkEl("div", {
      class: "popup-backdrop",
      onclick: () => closePopup(),
    });
    const panel = mkEl("div", { class: "popup-panel" });

    const closeBtn = mkEl("button", {
      class: "popup-close",
      type: "button",
      "aria-label": "Close",
      onclick: () => closePopup(),
    }, "×");
    panel.append(closeBtn);

    const star = mkEl("button", {
      class: "popup-star" + (state.saved.has(char) ? " active" : ""),
      type: "button",
      "aria-pressed": state.saved.has(char) ? "true" : "false",
      "aria-label": state.saved.has(char) ? "Remove from saved" : "Save",
    }, state.saved.has(char) ? "★" : "☆");
    star.addEventListener("click", () => {
      toggleSaved(char);
      const on = state.saved.has(char);
      star.classList.toggle("active", on);
      star.textContent = on ? "★" : "☆";
      star.setAttribute("aria-pressed", on ? "true" : "false");
      star.setAttribute("aria-label", on ? "Remove from saved" : "Save");
      renderPopupSavedList();
    });
    panel.append(star);

    panel.append(mkEl("div", { class: "popup-pinyin" }, c?.pinyin || ""));

    const writerWrap = mkEl("div", { class: "popup-writer", "data-char": char });
    panel.append(writerWrap);

    if (c?.definitions?.length) {
      panel.append(mkEl("div", { class: "popup-meaning" }, c.definitions.join("; ")));
    } else {
      panel.append(mkEl("div", { class: "popup-meaning popup-muted" }, "No dictionary entry."));
    }

    if (c?.originalMeaning && c.originalMeaning !== "characterless component") {
      panel.append(
        mkEl("div", { class: "popup-orig" }, `Originally: ${c.originalMeaning}`),
      );
    }
    if (c?.notes) {
      panel.append(mkEl("div", { class: "popup-etym" }, c.notes));
    }

    const savedList = mkEl("div", { class: "popup-saved" });
    panel.append(savedList);

    popupEl.append(backdrop, panel);
    document.body.appendChild(popupEl);

    renderPopupSavedList();
    requestAnimationFrame(() => mountPopupWriter(writerWrap));

    function renderPopupSavedList() {
      savedList.replaceChildren();
      const matches = [...state.saved].filter((w) => w !== char && w.includes(char));
      if (!matches.length) return;
      savedList.append(mkEl("div", { class: "popup-saved-title" }, "In your saved words"));
      const chips = mkEl("div", { class: "popup-saved-chips" });
      for (const w of matches) {
        const word = findWord(w);
        chips.append(
          mkEl(
            "button",
            {
              class: "chip",
              type: "button",
              onclick: () => {
                closePopup();
                openWord(w);
              },
            },
            word ? `${w} · ${word.pinyin}` : w,
          ),
        );
      }
      savedList.append(chips);
    }
  }

  function mountPopupWriter(el) {
    const ch = el.dataset.char;
    if (!ch || typeof HanziWriter === "undefined") {
      el.append(mkEl("div", { class: "popup-writer-fallback" }, ch));
      return;
    }
    try {
      const size = Math.min(280, el.clientWidth || 280);
      popupWriter = HanziWriter.create(el, ch, {
        width: size,
        height: size,
        padding: 6,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 120,
        strokeColor: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222",
        outlineColor: getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#ddd",
        onLoadCharDataError: () => {
          el.replaceChildren(mkEl("div", { class: "popup-writer-fallback" }, ch));
        },
      });
      popupWriter.animateCharacter();
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Replay stroke animation for ${ch}`);
      const replay = () => popupWriter && popupWriter.animateCharacter();
      el.addEventListener("click", replay);
    } catch (e) {
      el.append(mkEl("div", { class: "popup-writer-fallback" }, ch));
    }
  }

  function closePopup() {
    popupWriter = null;
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
  }

  function renderStarSlot(entry) {
    if (entry.kind !== "word") return mkEl("span", { class: "star-slot" });
    const word = entry.key;
    const btn = mkEl("button", {
      class: "star-btn",
      type: "button",
      "aria-label": state.saved.has(word) ? "Remove from saved" : "Save word",
      "aria-pressed": state.saved.has(word) ? "true" : "false",
    });
    btn.textContent = state.saved.has(word) ? "★" : "☆";
    if (state.saved.has(word)) btn.classList.add("active");
    btn.addEventListener("click", () => {
      toggleSaved(word);
      btn.textContent = state.saved.has(word) ? "★" : "☆";
      btn.classList.toggle("active", state.saved.has(word));
      btn.setAttribute("aria-pressed", state.saved.has(word) ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        state.saved.has(word) ? "Remove from saved" : "Save word",
      );
    });
    return btn;
  }

  function buildTreeForWord(wordKey) {
    const w = findWord(wordKey);
    if (!w) return mkEl("p", { class: "etym" }, `Unknown word: ${wordKey}`);
    return buildTreeContainer(buildWordTree(w));
  }

  function buildTreeForChar(charKey) {
    return buildTreeContainer(buildCharTree(charKey, "iconic"));
  }

  // ---------- decomposition tree ----------

  function buildCharTree(char, role, depth = 0, ancestors = new Set()) {
    if (ancestors.has(char) || depth > MAX_TREE_DEPTH) {
      return { char, role, depth, children: [] };
    }
    const next = new Set(ancestors);
    next.add(char);

    const c = state.data.chars[char];
    const node = { char, role, depth, children: [] };
    if (!c?.hasEtymology) return node;

    for (const comp of c.components) {
      if (comp.char === CHARACTERLESS) continue;
      const child = buildCharTree(comp.char, comp.type || "unknown", depth + 1, next);
      child.fragment = comp.fragment;
      child.compDef = comp.definition;
      node.children.push(child);
    }
    return node;
  }

  function buildWordTree(w) {
    if (w.chars.length === 1) return buildCharTree(w.chars[0], "iconic");
    return {
      char: w.simp,
      role: "word",
      depth: 0,
      isWord: true,
      pinyin: w.pinyin,
      gloss: w.definitions?.[0] || "",
      children: w.chars.map((ch) => {
        const sub = buildCharTree(ch, "iconic", 0);
        sub.depth = 1;
        return sub;
      }),
    };
  }

  function walkTree(node, fn) {
    fn(node);
    for (const c of node.children) walkTree(c, fn);
  }

  async function loadStrokeData(char) {
    if (state.strokeCache.has(char)) return state.strokeCache.get(char);
    if (typeof HanziWriter === "undefined") return null;
    try {
      const data = await HanziWriter.loadCharacterData(char);
      state.strokeCache.set(char, data || null);
      return data || null;
    } catch {
      state.strokeCache.set(char, null);
      return null;
    }
  }

  function buildTreeContainer(treeData) {
    const wrap = mkEl("div", { class: "tree-container" });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("tree-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Decomposition tree for ${treeData.char}`);
    wrap.append(svg);

    requestAnimationFrame(() => renderTree(svg, treeData));
    return wrap;
  }

  function appendCardGlyph(parent, node, strokeData) {
    if (strokeData?.strokes?.length) {
      const inner = document.createElementNS(SVG_NS, "svg");
      inner.setAttribute("viewBox", "0 0 1024 1024");
      inner.setAttribute("class", "card-glyph-svg");
      const tg = document.createElementNS(SVG_NS, "g");
      tg.setAttribute("transform", "translate(0, 900) scale(1, -1)");
      inner.appendChild(tg);
      const total = strokeData.strokes.length;
      for (let i = 0; i < total; i++) {
        const role = strokeRoleForIndex(node, i, total);
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", strokeData.strokes[i]);
        path.setAttribute("fill", `var(--role-${role})`);
        tg.appendChild(path);
      }
      parent.appendChild(inner);
    } else {
      const txt = document.createElementNS(XHTML_NS, "div");
      txt.className = "card-glyph-fallback";
      txt.textContent = node.char;
      txt.style.color = `var(--role-${node.role || "unknown"})`;
      parent.appendChild(txt);
    }
  }

  function buildNodeCard(gEl, d) {
    const node = d.data;
    const role = node.role || "unknown";
    const cd = state.data.chars[node.char];
    const py = node.pinyin || cd?.pinyin || "";
    const gloss = node.gloss || node.compDef || cd?.definitions?.[0] || "";
    const etymText = node.isWord
      ? ""
      : (cd?.notes?.trim()
        || (cd?.originalMeaning && cd.originalMeaning !== "characterless component"
              ? `Originally: ${cd.originalMeaning}`
              : ""));

    const fo = document.createElementNS(SVG_NS, "foreignObject");
    fo.setAttribute("class", "node-card-fo");
    fo.setAttribute("x", String(-CARD_W / 2));
    fo.setAttribute("y", String(-CARD_H / 2));
    fo.setAttribute("width", String(CARD_W));
    fo.setAttribute("height", String(CARD_H));
    gEl.appendChild(fo);

    const card = document.createElementNS(XHTML_NS, "div");
    card.className = `node-card role-${role}${node.isWord ? " is-word" : ""}`;
    fo.appendChild(card);

    if (py) {
      const p = document.createElementNS(XHTML_NS, "div");
      p.className = "card-pinyin";
      p.textContent = py;
      card.appendChild(p);
    }

    if (node.isWord) {
      // Render the multi-char word horizontally — pure text, sized to fit.
      const word = document.createElementNS(XHTML_NS, "div");
      word.className = "card-word";
      const n = Math.max(2, node.char.length);
      const fontSize = Math.min(96, Math.floor((CARD_W - 32) / n) - 2);
      word.style.fontSize = `${fontSize}px`;
      word.textContent = node.char;
      card.appendChild(word);
    } else {
      const glyphSlot = document.createElementNS(XHTML_NS, "div");
      glyphSlot.className = "card-glyph";
      card.appendChild(glyphSlot);
      appendCardGlyph(glyphSlot, node, state.strokeCache.get(node.char));

      if (role && role !== "iconic") {
        const r = document.createElementNS(XHTML_NS, "div");
        r.className = `card-role role-${role}`;
        r.textContent = ROLE_LABEL[role] || "Component";
        card.appendChild(r);
      }
    }

    if (gloss) {
      const g = document.createElementNS(XHTML_NS, "div");
      g.className = "card-gloss";
      g.textContent = gloss.length > 80 ? gloss.slice(0, 79) + "…" : gloss;
      card.appendChild(g);
    }

    if (etymText) {
      const e = document.createElementNS(XHTML_NS, "div");
      e.className = "card-etym";
      e.textContent = etymText;
      card.appendChild(e);
    }
  }

  // For a stroke at index `idx` in the parent, return the role color of whichever
  // child component owns that stroke (per chinese-lexicon's `fragment` ranges),
  // or the parent's own role if no child claims it.
  function strokeRoleForIndex(node, idx, totalStrokes) {
    for (const child of node.children || []) {
      if (!Array.isArray(child.fragment)) continue;
      const [s, e] = child.fragment;
      const end = e == null ? totalStrokes : e;
      if (idx >= s && idx < end) return child.role || "unknown";
    }
    return node.role || "unknown";
  }

  async function renderTree(svgEl, treeData) {
    if (typeof d3 === "undefined") {
      svgEl.replaceWith(mkEl("div", { class: "etym" }, "Tree library failed to load."));
      return;
    }

    const chars = new Set();
    walkTree(treeData, (n) => chars.add(n.char));
    await Promise.all([...chars].map((c) => loadStrokeData(c)));

    const root = d3.hierarchy(treeData);
    const dx = CARD_W + 10;
    const dy = CARD_H + 24;
    d3.tree().nodeSize([dx, dy])(root);

    let minX = Infinity, maxX = -Infinity, maxY = 0;
    root.each((d) => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    });
    const padX = CARD_W / 2 + 12;
    const padTop = CARD_H / 2 + 12;
    const padBottom = CARD_H_EXPANDED / 2 + 16;
    const vbX = minX - padX;
    const vbY = -padTop;
    const vbW = maxX - minX + padX * 2;
    const vbH = maxY + padTop + padBottom;

    const svg = d3.select(svgEl);
    svg.attr("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`).attr("preserveAspectRatio", "xMidYMin meet");
    svg.selectAll("*").remove();

    const root_g = svg.append("g");

    const HALF = CARD_H / 2;
    const linkPath = (d) => {
      const sx = d.source.x, sy = d.source.y + HALF;
      const tx = d.target.x, ty = d.target.y - HALF;
      const my = (sy + ty) / 2;
      return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
    };

    root_g.append("g")
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("class", (d) => `link role-${d.target.data.role || "unknown"}`)
      .attr("d", linkPath);

    const node = root_g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .on("click", (_, d) => {
        if (d.data.isWord) return;
        if (d.data.char === CHARACTERLESS) return;
        openCharPopup(d.data.char);
      });

    node.each(function (d) {
      buildNodeCard(this, d);
    });

    let lastExpanded = false;
    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .on("zoom", (e) => {
        root_g.attr("transform", e.transform.toString());
        const k = e.transform.k;
        const expanded = k > 1.7;
        if (expanded !== lastExpanded) {
          lastExpanded = expanded;
          svgEl.classList.toggle("zoom-lg", expanded);
          // Keep top edge anchored; grow downward so card overlaps link area.
          svg.selectAll(".node-card-fo")
            .attr("height", expanded ? CARD_H_EXPANDED : CARD_H);
        }
      });

    svg.call(zoom);
  }

  // ---------- wiring ----------

  window.addEventListener("popstate", (ev) => {
    const desiredLen = ev.state?.stackLen || 0;
    while (state.stack.length > desiredLen) state.stack.pop();
    state.stack.length === 0 ? closeModal() : renderModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (popupEl) closePopup();
    else if (state.stack.length > 0) popEntry(false);
  });

  if (searchInput) {
    let debounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.query = searchInput.value;
        renderHome();
      }, 90);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        searchInput.value = "";
        state.query = "";
        renderHome();
      } else if (e.key === "Enter") {
        const first = resultsRoot.querySelector(".result-row") || grid.querySelector(".card");
        if (first) first.click();
      }
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      state.page += 1;
      renderGridPage();
    });
  }

  // ---------- boot ----------

  (async function boot() {
    const loader = mkEl(
      "div",
      { class: "boot-loading", id: "boot-loading" },
      "Loading dictionary…",
    );
    document.body.appendChild(loader);
    await loadData();
    loader.remove();
    if (!state.data) return;
    renderHome();

    const initial = parseHash();
    if (initial) {
      if (initial.kind === "word" && findWord(initial.key)) openWord(initial.key);
      else if (initial.kind === "char" && state.data.chars[initial.key]) openChar(initial.key);
    }
  })();
})();
