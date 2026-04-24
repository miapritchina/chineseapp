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

  const ROLE_FALLBACK = {
    iconic: "#2563eb",
    meaning: "#16a34a",
    sound: "#dc2626",
    simplified: "#9333ea",
    deleted: "#6b7280",
    unknown: "#6b7280",
  };

  const CHARACTERLESS = "◎";
  const PAGE_SIZE = 60;
  const MAX_RESULTS = 30;

  const state = {
    data: null,
    stack: [],
    writers: [],
    query: "",
    page: 1,
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

  function normalizePinyin(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  const HAN_RE = /[㐀-鿿豈-﫿]/;

  function mkEl(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
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

  // ---------- search ranking ----------

  function rankResults(query) {
    if (!state.data) return [];
    const q = query.trim();
    if (!q) return [];
    const isHan = HAN_RE.test(q);
    const np = normalizePinyin(q);
    const lq = q.toLowerCase();

    const tiered = [];
    for (const w of state.data.words) {
      const simp = w.simp || w.word;
      const sp = w.searchablePinyin || normalizePinyin(w.pinyin);
      let tier = -1;
      if (isHan) {
        if (simp === q) tier = 0;
        else if (simp.startsWith(q)) tier = 1;
        else if (simp.includes(q)) tier = 2;
      } else {
        if (np && sp.startsWith(np)) tier = 1;
        else if (np && sp.includes(np)) tier = 3;
        else if ((w.definitions || []).some((d) => d.toLowerCase().includes(lq))) tier = 4;
      }
      if (tier === -1) continue;
      tiered.push({ w, tier, rank: w.rank ?? 999999 });
    }
    tiered.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
    return tiered.slice(0, MAX_RESULTS).map((x) => x.w);
  }

  // ---------- card builder ----------

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
      {
        class: "result-row",
        type: "button",
        onclick: () => openWord(w.word),
      },
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

  // ---------- home / results render ----------

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
    suggestedShelf.innerHTML = "";
    const list = state.data.suggested || [];
    if (!list.length) {
      suggestedSection.hidden = true;
      return;
    }
    suggestedSection.hidden = false;
    for (const word of list) {
      const w = findWord(word);
      if (w) suggestedShelf.append(buildCard(w));
    }
  }

  function renderGridPage() {
    grid.innerHTML = "";
    const total = state.data.words.length;
    const upTo = Math.min(state.page * PAGE_SIZE, total);
    for (let i = 0; i < upTo; i++) {
      grid.append(buildCard(state.data.words[i]));
    }
    if (loadMoreBtn) loadMoreBtn.hidden = upTo >= total;
  }

  function renderResults() {
    resultsRoot.hidden = false;
    resultsRoot.innerHTML = "";
    const matches = rankResults(state.query);
    if (!matches.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (emptyState) emptyState.hidden = true;
    for (const w of matches) resultsRoot.append(buildResultRow(w));
  }

  // ---------- modal / stack ----------

  function openWord(word) {
    pushEntry({ kind: "word", key: word }, false);
  }
  function openChar(char) {
    pushEntry({ kind: "char", key: char }, false);
  }

  function pushEntry(entry, fromHistory) {
    state.stack.push(entry);
    if (!fromHistory) {
      history.pushState({ stackLen: state.stack.length }, "", locationForEntry(entry));
    }
    renderModal();
  }

  function popEntry(fromHistory) {
    if (state.stack.length === 0) return;
    state.stack.pop();
    if (state.stack.length === 0) {
      closeModal();
      if (!fromHistory && history.state && history.state.stackLen) history.back();
    } else {
      renderModal();
      if (!fromHistory) history.back();
    }
  }

  function closeModal() {
    destroyWriters();
    modalRoot.innerHTML = "";
    modalRoot.classList.remove("open");
    modalRoot.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function locationForEntry(e) {
    const prefix = e.kind === "word" ? "w" : "c";
    return `#/${prefix}/${encodeURIComponent(e.key)}`;
  }

  function destroyWriters() {
    state.writers = [];
  }

  function renderModal() {
    if (state.stack.length === 0) {
      closeModal();
      return;
    }
    const entry = state.stack[state.stack.length - 1];
    destroyWriters();

    modalRoot.innerHTML = "";
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
    else renderCharBody(body, entry.key);

    modalRoot.append(header, body);
    modalRoot.scrollTop = 0;

    requestAnimationFrame(() => {
      $$(".glyph-wrap[data-char]", modalRoot).forEach((el) => attachWriter(el));
    });
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
      c && c.pinyin ? mkEl("span", { class: "title-pinyin" }, c.pinyin) : null,
    );
  }

  function findWord(wordKey) {
    return state.data.words.find((w) => w.word === wordKey) || null;
  }

  // ---------- word body ----------

  function renderWordBody(root, wordKey) {
    const w = findWord(wordKey);
    if (!w) {
      root.append(mkEl("p", {}, `Unknown word: ${wordKey}`));
      return;
    }

    if (w.definitions && w.definitions.length && w.chars.length > 1) {
      root.append(
        mkEl("div", { class: "section-title" }, "Meaning"),
        mkEl(
          "div",
          { class: "etym" },
          mkEl(
            "div",
            { style: "font-size: 15px; text-align: center" },
            w.definitions.join("; "),
          ),
        ),
      );
    }

    for (const ch of w.chars) {
      root.append(renderCharSection(ch));
    }
  }

  // ---------- char body ----------

  function renderCharBody(root, charKey) {
    const c = state.data.chars[charKey];
    if (!c) {
      root.append(
        mkEl(
          "div",
          { class: "char-section" },
          mkEl("div", { class: "glyph-fallback" }, charKey),
          mkEl("p", { class: "etym" }, "No etymology available for this component."),
        ),
      );
      return;
    }
    root.append(renderCharSection(charKey));
  }

  // ---------- char section (Dong-Chinese style) ----------

  function renderCharSection(charKey) {
    const c = state.data.chars[charKey];
    const section = mkEl("section", { class: "char-section" });

    if (!c) {
      section.append(
        mkEl("div", { class: "glyph-fallback" }, charKey),
        mkEl(
          "div",
          { class: "char-meta-block" },
          mkEl("div", { class: "char-defs" }, "No data for this character."),
        ),
      );
      return section;
    }

    const glyphWrap = mkEl("div", {
      class: "glyph-wrap",
      dataset: { char: charKey },
      tabindex: "0",
      role: "button",
      "aria-label": `Replay stroke animation for ${charKey}`,
    });

    const meta = mkEl(
      "div",
      { class: "char-meta-block" },
      c.pinyin ? mkEl("div", { class: "char-pinyin" }, c.pinyin) : null,
      c.definitions && c.definitions.length
        ? mkEl("div", { class: "char-defs" }, c.definitions.join("; "))
        : null,
      mkEl("div", { class: "replay-hint" }, "Tap to replay strokes"),
    );

    section.append(glyphWrap, meta);

    if (c.components && c.components.length) {
      section.append(mkEl("div", { class: "section-title" }, "Components"));
      const list = mkEl("div", { class: "components" });
      for (const comp of c.components) {
        list.append(renderComponentRow(comp, glyphWrap));
      }
      section.append(list);
    }

    if (c.notes || c.originalMeaning) {
      section.append(mkEl("div", { class: "section-title" }, "Etymology"));
      const etym = mkEl("div", { class: "etym" });
      if (c.originalMeaning && c.originalMeaning !== "characterless component") {
        etym.append(mkEl("div", { class: "orig" }, `Original meaning: ${c.originalMeaning}`));
      }
      if (c.notes) etym.append(mkEl("div", {}, c.notes));
      section.append(etym);
    }

    if (c.appearsIn && c.appearsIn.length) {
      const currentTopWord =
        state.stack[state.stack.length - 1]?.kind === "word"
          ? state.stack[state.stack.length - 1].key
          : null;
      const others = c.appearsIn.filter((w) => w !== currentTopWord).slice(0, 30);
      if (others.length) {
        section.append(mkEl("div", { class: "section-title" }, "Also appears in"));
        const chips = mkEl("div", { class: "appears-in" });
        for (const w of others) {
          const wordObj = findWord(w);
          if (!wordObj) continue;
          chips.append(
            mkEl(
              "button",
              { class: "chip", type: "button", onclick: () => openWord(w) },
              `${w} · ${wordObj.pinyin}`,
            ),
          );
        }
        if (chips.children.length) section.append(chips);
      }
    }

    section.append(mkEl("div", { class: "section-title" }, "My story"));
    section.append(renderMnemonic(charKey));

    return section;
  }

  function renderComponentRow(comp, glyphWrap) {
    const role = ROLE_LABEL[comp.type] || "Component";
    const hasData = comp.char !== CHARACTERLESS && !!state.data.chars[comp.char];
    const clickable = hasData;

    const setActive = (active) => {
      if (!glyphWrap) return;
      const svg = glyphWrap.querySelector("svg");
      if (!svg) return;
      glyphWrap.classList.toggle("has-active", active);
      $$(`path[data-stroke-idx]`, svg).forEach((p) => {
        const idx = +p.dataset.strokeIdx;
        const f = comp.fragment;
        if (!Array.isArray(f)) {
          p.removeAttribute("data-role-active");
          return;
        }
        const [s, e] = f;
        const end = e == null ? Infinity : e;
        if (active && idx >= s && idx < end) p.setAttribute("data-role-active", "");
        else p.removeAttribute("data-role-active");
      });
    };

    const row = mkEl(
      "button",
      {
        class: `component-row${clickable ? "" : " inert"}`,
        type: "button",
        disabled: clickable ? null : "disabled",
        onclick: clickable ? () => openChar(comp.char) : null,
      },
      mkEl("span", { class: `component-char role-${comp.type}` }, comp.char),
      mkEl(
        "div",
        { class: "component-info" },
        mkEl(
          "div",
          {},
          mkEl("span", { class: `component-role role-${comp.type}` }, role),
        ),
        mkEl(
          "div",
          { class: "component-gloss" },
          [comp.char, comp.pinyin, comp.definition].filter(Boolean).join(" · "),
        ),
        comp.hint ? mkEl("div", { class: "component-hint" }, comp.hint) : null,
      ),
    );

    row.addEventListener("mouseenter", () => setActive(true));
    row.addEventListener("mouseleave", () => setActive(false));
    row.addEventListener("focus", () => setActive(true));
    row.addEventListener("blur", () => setActive(false));

    return row;
  }

  // ---------- mnemonic ----------

  function renderMnemonic(charKey) {
    const storageKey = `chinese.mnemonic.${charKey}`;
    const existing = localStorage.getItem(storageKey) || "";
    let saveTimer = null;

    const ta = mkEl("textarea", {
      placeholder:
        "Write your own mnemonic — a short story connecting the character's shape, components, and meaning. The more vivid and personal, the stickier it gets.",
    });
    ta.value = existing;

    ta.addEventListener("input", () => {
      const hint = ta.nextSibling;
      if (hint && hint.classList && hint.classList.contains("mnemonic-hint")) {
        hint.textContent = "Saving…";
      }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, ta.value);
          if (hint) hint.textContent = "Saved locally.";
        } catch (e) {
          if (hint) hint.textContent = "Could not save (storage blocked).";
        }
      }, 350);
    });

    return mkEl(
      "div",
      { class: "mnemonic" },
      ta,
      mkEl("div", { class: "mnemonic-hint" }, existing ? "Saved locally." : "Saved to this device only."),
    );
  }

  // ---------- hanzi-writer + stroke tinting ----------

  function paintComponentColors(svg, components) {
    const paths = $$("path[data-stroke-idx]", svg);
    if (!paths.length || !Array.isArray(components)) return;
    const total = paths.length;
    for (const path of paths) {
      const idx = +path.dataset.strokeIdx;
      let role = "unknown";
      for (const comp of components) {
        const f = comp.fragment;
        if (!Array.isArray(f)) continue;
        const [s, e] = f;
        const end = e == null ? total : e;
        if (idx >= s && idx < end) {
          role = comp.type || "unknown";
          break;
        }
      }
      path.setAttribute("data-role", role);
      path.setAttribute("stroke", ROLE_FALLBACK[role] || ROLE_FALLBACK.unknown);
    }
  }

  function tagStrokePaths(el) {
    const svg = el.querySelector("svg");
    if (!svg) return [];
    // Hanzi-writer creates one stroke-animation <path> per stroke directly in <svg>;
    // each has a clip-path attribute (outline paths don't). DOM order = stroke order.
    const all = Array.from(svg.querySelectorAll("path[clip-path]"));
    all.forEach((p, i) => p.setAttribute("data-stroke-idx", String(i)));
    return all;
  }

  function attachWriter(el) {
    const ch = el.dataset.char;
    if (!ch) return;
    el.innerHTML = "";
    if (typeof HanziWriter === "undefined") {
      el.append(mkEl("div", { class: "glyph-fallback" }, ch));
      return;
    }
    const charData = state.data.chars[ch];
    const components = charData?.components || [];

    try {
      const size = el.clientWidth || 240;
      const writer = HanziWriter.create(el, ch, {
        width: size,
        height: size,
        padding: 8,
        showOutline: true,
        showCharacter: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 140,
        strokeColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim() || "#222",
        outlineColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--border")
          .trim() || "#ddd",
        onLoadCharDataError: () => {
          el.innerHTML = "";
          el.append(mkEl("div", { class: "glyph-fallback" }, ch));
        },
        onLoadCharDataSuccess: () => {
          // Wait for hanzi-writer to mount paths, then tint.
          requestAnimationFrame(() => {
            tagStrokePaths(el);
            paintComponentColors(el.querySelector("svg"), components);
          });
        },
      });
      state.writers.push(writer);

      const replay = () => {
        const p = writer.animateCharacter();
        if (p && typeof p.then === "function") {
          p.then(() => {
            tagStrokePaths(el);
            paintComponentColors(el.querySelector("svg"), components);
          });
        }
      };

      el.addEventListener("click", replay);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          replay();
        }
      });
    } catch (e) {
      console.error("HanziWriter error for", ch, e);
      el.append(mkEl("div", { class: "glyph-fallback" }, ch));
    }
  }

  // ---------- history integration ----------

  function parseHash() {
    const m = /^#\/(w|c)\/(.+)$/.exec(location.hash);
    if (!m) return null;
    return { kind: m[1] === "w" ? "word" : "char", key: decodeURIComponent(m[2]) };
  }

  window.addEventListener("popstate", (ev) => {
    const desiredLen = (ev.state && ev.state.stackLen) || 0;
    while (state.stack.length > desiredLen) state.stack.pop();
    if (state.stack.length === 0) closeModal();
    else renderModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && state.stack.length > 0) popEntry(false);
  });

  // ---------- search wiring ----------

  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
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
    renderHome();

    const initial = parseHash();
    if (initial) {
      if (initial.kind === "word" && findWord(initial.key)) openWord(initial.key);
      else if (initial.kind === "char" && state.data?.chars?.[initial.key]) openChar(initial.key);
    }
  })();
})();
