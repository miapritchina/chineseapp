(() => {
  "use strict";

  const ROLE_LABEL = {
    iconic: "Iconic",
    meaning: "Meaning",
    sound: "Sound",
    simplified: "Simplified",
    deleted: "Deleted",
    unknown: "Component",
  };

  const CHARACTERLESS = "◎";
  const PAGE_SIZE = 60;
  const MAX_RESULTS = 30;
  const MAX_TREE_DEPTH = 5;
  const HAN_RE = /[㐀-鿿豈-﫿]/;

  const state = {
    data: null,
    stack: [],
    query: "",
    page: 1,
    strokeCache: new Map(),
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const home = $("#home");
  const grid = $("#grid");
  const suggestedSection = $("#suggested-section");
  const suggestedShelf = $("#suggested-shelf");
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
    renderSuggestedShelf();
    renderGridPage();
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
      mkEl("span", { style: "min-width: 62px" }),
    );

    const body = mkEl("div", { class: "modal-body" });
    if (entry.kind === "word") renderWordBody(body, entry.key);
    else renderCharModalBody(body, entry.key);

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

  function renderWordBody(root, wordKey) {
    const w = findWord(wordKey);
    if (!w) {
      root.append(mkEl("p", {}, `Unknown word: ${wordKey}`));
      return;
    }

    root.append(buildTreeContainer(buildWordTree(w)));

    if (w.definitions?.length && w.chars.length > 1) {
      root.append(
        mkEl("div", { class: "section-title" }, "Meaning"),
        mkEl("div", { class: "etym" }, w.definitions.join("; ")),
      );
    }

    for (const ch of w.chars) root.append(renderCharDetail(ch));
  }

  function renderCharModalBody(root, charKey) {
    const c = state.data.chars[charKey];
    root.append(buildTreeContainer(buildCharTree(charKey, "iconic")));
    if (c) root.append(renderCharDetail(charKey));
    else root.append(mkEl("p", { class: "etym" }, "No data for this character."));
  }

  function renderCharDetail(charKey) {
    const c = state.data.chars[charKey];
    const wrap = mkEl("section", { class: "char-detail" });

    if (!c) {
      wrap.append(mkEl("div", {}, charKey + ": no data."));
      return wrap;
    }

    wrap.append(
      mkEl(
        "div",
        { class: "char-detail-header" },
        mkEl("span", { class: "ch" }, charKey),
        c.pinyin ? mkEl("span", { class: "py" }, c.pinyin) : null,
        c.definitions?.length
          ? mkEl("span", { class: "df" }, c.definitions.join("; "))
          : null,
      ),
    );

    if (c.notes || c.originalMeaning) {
      const etym = mkEl("div", { class: "etym" });
      if (c.originalMeaning && c.originalMeaning !== "characterless component") {
        etym.append(mkEl("div", { class: "orig" }, `Original meaning: ${c.originalMeaning}`));
      }
      if (c.notes) etym.append(mkEl("div", {}, c.notes));
      wrap.append(mkEl("div", { class: "section-title" }, "Etymology"), etym);
    }

    const top = state.stack[state.stack.length - 1];
    const currentTopWord = top?.kind === "word" ? top.key : null;
    const others = (c.appearsIn || [])
      .filter((w) => w !== currentTopWord)
      .map((w) => findWord(w))
      .filter(Boolean)
      .slice(0, 30);
    if (others.length) {
      const chips = mkEl("div", { class: "appears-in" });
      for (const w of others) {
        chips.append(
          mkEl(
            "button",
            { class: "chip", type: "button", onclick: () => openWord(w.word) },
            `${w.word} · ${w.pinyin}`,
          ),
        );
      }
      wrap.append(mkEl("div", { class: "section-title" }, "Also appears in"), chips);
    }

    wrap.append(mkEl("div", { class: "section-title" }, "My story"), renderMnemonic(charKey));
    return wrap;
  }

  function renderMnemonic(charKey) {
    const storageKey = `chinese.mnemonic.${charKey}`;
    const existing = localStorage.getItem(storageKey) || "";
    const ta = mkEl("textarea", {
      placeholder:
        "Write a short story connecting the components, shape, and meaning. The more vivid and personal, the stickier it gets.",
    });
    ta.value = existing;

    const hint = mkEl("div", { class: "mnemonic-hint" }, existing ? "Saved locally." : "Saved to this device only.");

    let timer = null;
    ta.addEventListener("input", () => {
      hint.textContent = "Saving…";
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, ta.value);
          hint.textContent = "Saved locally.";
        } catch {
          hint.textContent = "Could not save (storage blocked).";
        }
      }, 350);
    });

    return mkEl("div", { class: "mnemonic" }, ta, hint);
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
      child.compPinyin = comp.pinyin;
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
    const controls = mkEl(
      "div",
      { class: "tree-controls" },
      mkEl("button", { type: "button", "data-zoom": "out", title: "Zoom out" }, "−"),
      mkEl("button", { type: "button", "data-zoom": "reset", title: "Reset" }, "Reset"),
      mkEl("button", { type: "button", "data-zoom": "in", title: "Zoom in" }, "+"),
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("tree-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Decomposition tree for ${treeData.char}`);
    const hint = mkEl("div", { class: "tree-hint" }, "Drag to pan · pinch / scroll to zoom · tap a node");
    wrap.append(controls, svg, hint);

    requestAnimationFrame(() => renderTree(svg, controls, treeData));
    return wrap;
  }

  async function renderTree(svgEl, controls, treeData) {
    if (typeof d3 === "undefined") {
      svgEl.replaceWith(mkEl("div", { class: "etym" }, "Tree library failed to load."));
      return;
    }

    const chars = new Set();
    walkTree(treeData, (n) => chars.add(n.char));
    await Promise.all([...chars].map((c) => loadStrokeData(c)));

    const root = d3.hierarchy(treeData);
    const dx = 110;
    const dy = 130;
    d3.tree().nodeSize([dx, dy])(root);

    let minX = Infinity, maxX = -Infinity, maxY = 0;
    root.each((d) => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    });
    const padX = dx / 2 + 10;
    const padTop = 30;
    const padBottom = 80;
    const vbX = minX - padX;
    const vbY = -padTop;
    const vbW = maxX - minX + padX * 2;
    const vbH = maxY + padTop + padBottom;

    const svg = d3.select(svgEl);
    svg.attr("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`).attr("preserveAspectRatio", "xMidYMin meet");
    svg.selectAll("*").remove();

    const root_g = svg.append("g");

    const linkPath = (d) => {
      const sx = d.source.x, sy = d.source.y + 32;
      const tx = d.target.x, ty = d.target.y - 32;
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
        openChar(d.data.char);
      });

    node.append("rect")
      .attr("class", "node-bg")
      .attr("x", -42).attr("y", -42)
      .attr("width", 84).attr("height", 84)
      .attr("rx", 8);

    node.each(function (d) {
      const sel = d3.select(this);
      const data = state.strokeCache.get(d.data.char);
      const role = d.data.role || "unknown";
      const size = d.data.isWord ? 70 : Math.max(48, 64 - d.depth * 4);
      const fill = d.data.isWord ? "var(--text)" : `var(--role-${role})`;

      if (data?.strokes?.length) {
        const inner = sel.append("svg")
          .attr("class", "node-glyph")
          .attr("viewBox", "0 0 1024 1024")
          .attr("width", size).attr("height", size)
          .attr("x", -size / 2).attr("y", -size / 2);
        const tg = inner.append("g").attr("transform", "translate(0, 900) scale(1, -1)");
        for (const path of data.strokes) tg.append("path").attr("d", path).attr("fill", fill);
      } else {
        sel.append("text")
          .attr("class", "node-fallback")
          .attr("y", size * 0.32)
          .attr("font-size", size * 0.95)
          .attr("fill", fill)
          .text(d.data.char);
      }

      const cd = state.data.chars[d.data.char];
      const py = d.data.pinyin || cd?.pinyin;
      if (py) sel.append("text").attr("class", "node-pinyin").attr("y", 56).text(py);

      if (!d.data.isWord && d.data.role && d.data.role !== "iconic") {
        sel.append("text")
          .attr("class", `node-role role-${d.data.role}`)
          .attr("y", 70)
          .attr("fill", `var(--role-${d.data.role})`)
          .text(ROLE_LABEL[d.data.role] || "");
      }

      const gloss = d.data.gloss || d.data.compDef || cd?.definitions?.[0] || "";
      if (gloss) {
        sel.append("text")
          .attr("class", "node-gloss")
          .attr("y", 84)
          .text(gloss.length > 18 ? gloss.slice(0, 17) + "…" : gloss);
      }
    });

    const zoom = d3.zoom()
      .scaleExtent([0.4, 6])
      .on("zoom", (e) => {
        root_g.attr("transform", e.transform.toString());
        const k = e.transform.k;
        svgEl.classList.toggle("zoom-md", k > 1.2);
        svgEl.classList.toggle("zoom-lg", k > 2.0);
      });

    svg.call(zoom);

    controls.querySelector('[data-zoom="in"]').onclick = () =>
      svg.transition().duration(180).call(zoom.scaleBy, 1.4);
    controls.querySelector('[data-zoom="out"]').onclick = () =>
      svg.transition().duration(180).call(zoom.scaleBy, 0.7);
    controls.querySelector('[data-zoom="reset"]').onclick = () =>
      svg.transition().duration(220).call(zoom.transform, d3.zoomIdentity);

    // Initial state: pinyin/role/gloss hidden until zoom; reveal at default scale by setting threshold check.
    svgEl.classList.add("zoom-sm");
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
