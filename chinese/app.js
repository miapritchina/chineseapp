(() => {
  "use strict";

  const CHARACTERLESS = "◎";
  const PAGE_SIZE = 60;
  const MAX_RESULTS = 30;
  const MAX_TREE_DEPTH = 5;
  const HAN_RE = /[㐀-鿿豈-﫿]/;
  const SAVED_KEY = "chinese.saved";

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

  async function loadData() {
    try {
      const resp = await fetch("./data.json", { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.data = await resp.json();
    } catch (err) {
      console.error(err);
      document.body.prepend(
        mkEl("div", { class: "error-banner" }, `Failed to load data.json: ${err.message}`),
      );
    }
  }

  function findWord(wordKey) {
    return state.data.words.find((w) => w.word === wordKey) || null;
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
    for (const word of list) {
      const w = findWord(word);
      if (w) savedShelf.append(buildCard(w));
    }
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

  function openWord(word) {
    pushEntry({ kind: "word", key: word }, false);
  }

  function openChar(char) {
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
    const hint = mkEl("div", { class: "tree-hint" }, "drag to pan · pinch / scroll to zoom");
    wrap.append(svg, hint);

    requestAnimationFrame(() => renderTree(svg, treeData));
    return wrap;
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
    const dx = 110;
    const dy = 140;
    d3.tree().nodeSize([dx, dy])(root);

    let minX = Infinity, maxX = -Infinity, maxY = 0;
    root.each((d) => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    });
    const padX = dx / 2 + 10;
    const padTop = 40;
    const padBottom = 100;
    const vbX = minX - padX;
    const vbY = -padTop;
    const vbW = maxX - minX + padX * 2;
    const vbH = maxY + padTop + padBottom;

    const svg = d3.select(svgEl);
    svg.attr("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`).attr("preserveAspectRatio", "xMidYMin meet");
    svg.selectAll("*").remove();

    const root_g = svg.append("g");

    const linkPath = (d) => {
      const sx = d.source.x, sy = d.source.y + 30;
      const tx = d.target.x, ty = d.target.y - 38;
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
        if (d.depth === 0) return;
        if (d.data.char === CHARACTERLESS) return;
        openChar(d.data.char);
      });

    node.each(function (d) {
      const sel = d3.select(this);
      const data = state.strokeCache.get(d.data.char);
      const role = d.data.role || "unknown";
      const size = d.data.isWord ? 70 : Math.max(48, 64 - d.depth * 4);
      const ownFill = d.data.isWord ? "var(--text)" : `var(--role-${role})`;

      if (data?.strokes?.length) {
        const inner = sel.append("svg")
          .attr("class", "node-glyph")
          .attr("viewBox", "0 0 1024 1024")
          .attr("width", size).attr("height", size)
          .attr("x", -size / 2).attr("y", -size / 2);
        const tg = inner.append("g").attr("transform", "translate(0, 900) scale(1, -1)");
        const total = data.strokes.length;
        for (let i = 0; i < total; i++) {
          const r = strokeRoleForIndex(d.data, i, total);
          tg.append("path")
            .attr("d", data.strokes[i])
            .attr("fill", `var(--role-${r})`);
        }
      } else {
        sel.append("text")
          .attr("class", "node-fallback")
          .attr("y", size * 0.32)
          .attr("font-size", size * 0.95)
          .attr("fill", ownFill)
          .text(d.data.char);
      }

      const cd = state.data.chars[d.data.char];
      const py = d.data.pinyin || cd?.pinyin;
      if (py) {
        sel.append("text")
          .attr("class", "node-pinyin")
          .attr("y", -size / 2 - 10)
          .text(py);
      }

      const gloss = d.data.gloss || d.data.compDef || cd?.definitions?.[0] || "";
      if (gloss) {
        sel.append("text")
          .attr("class", "node-gloss")
          .attr("y", size / 2 + 18)
          .text(gloss.length > 22 ? gloss.slice(0, 21) + "…" : gloss);
      }

      const etymText = (cd?.notes && cd.notes.trim())
        || (cd?.originalMeaning && cd.originalMeaning !== "characterless component"
              ? `Originally: ${cd.originalMeaning}`
              : "");
      if (etymText) {
        const fo = sel.append("foreignObject")
          .attr("class", "node-etym-fo")
          .attr("x", -90)
          .attr("y", size / 2 + 28)
          .attr("width", 180)
          .attr("height", 80);
        const div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        div.className = "node-etym";
        div.textContent = etymText;
        fo.node().appendChild(div);
      }
    });

    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .on("zoom", (e) => {
        root_g.attr("transform", e.transform.toString());
        const k = e.transform.k;
        svgEl.classList.toggle("zoom-lg", k > 1.7);
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
    if (ev.key === "Escape" && state.stack.length > 0) popEntry(false);
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
    await loadData();
    if (!state.data) return;
    renderHome();

    const initial = parseHash();
    if (initial) {
      if (initial.kind === "word" && findWord(initial.key)) openWord(initial.key);
      else if (initial.kind === "char" && state.data.chars[initial.key]) openChar(initial.key);
    }
  })();
})();
