(() => {
  "use strict";

  const ROLE_LABEL = {
    iconic: "Iconic component",
    meaning: "Meaning component",
    sound: "Sound component",
    simplified: "Simplified component",
    deleted: "Deleted component",
    unknown: "Component",
  };

  const CHARACTERLESS = "◎";

  const state = {
    data: null,
    stack: [], // stack of entries: { kind: "word"|"char", key }
    writers: [], // active HanziWriter instances (per current modal render)
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const grid = $("#grid");
  const modalRoot = $("#modal-root");

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

  // ---------- home grid ----------

  function renderGrid() {
    grid.innerHTML = "";
    if (!state.data) return;
    for (const w of state.data.words) {
      const card = mkEl(
        "button",
        {
          class: "card",
          type: "button",
          "aria-label": `${w.word} ${w.pinyin}`,
          onclick: () => openWord(w.word),
        },
        mkEl("div", { class: "char" }, w.simp),
        mkEl("div", { class: "pinyin" }, w.pinyin),
        mkEl("div", { class: "gloss" }, w.definitions[0] || ""),
      );
      grid.appendChild(card);
    }
  }

  // ---------- modal / stack ----------

  function openWord(word) {
    pushEntry({ kind: "word", key: word }, /*fromHistory*/ false);
  }
  function openChar(char) {
    pushEntry({ kind: "char", key: char }, /*fromHistory*/ false);
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
    // hanzi-writer has no destroy; just drop references and clear their DOM.
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

    // Kick off writers after layout
    requestAnimationFrame(() => {
      $$(".writer-wrap[data-char]", modalRoot).forEach((el) => attachWriter(el));
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

    if (w.definitions && w.definitions.length) {
      root.append(
        mkEl("div", { class: "section-title" }, "Meaning"),
        mkEl(
          "div",
          { class: "etym" },
          mkEl(
            "div",
            { style: "font-size: 15px" },
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
      // Characterless placeholders or chars we never extracted.
      root.append(
        mkEl(
          "div",
          { class: "char-section" },
          mkEl("div", { class: "writer-fallback" }, charKey),
          mkEl("p", { class: "etym" }, "No etymology available for this component."),
        ),
      );
      return;
    }
    root.append(renderCharSection(charKey));
  }

  // ---------- char section (reusable) ----------

  function renderCharSection(charKey) {
    const c = state.data.chars[charKey];
    const section = mkEl("section", { class: "char-section" });

    if (!c) {
      section.append(
        mkEl(
          "div",
          { class: "char-header" },
          mkEl("div", { class: "writer-wrap" }, mkEl("div", { class: "writer-fallback" }, charKey)),
          mkEl(
            "div",
            { class: "char-meta" },
            mkEl("div", { class: "char-big" }, charKey),
            mkEl("div", { class: "char-defs" }, "No data for this character."),
          ),
        ),
      );
      return section;
    }

    // Header: stroke writer + meta
    const writerWrap = mkEl("div", { class: "writer-wrap", dataset: { char: charKey } });
    const header = mkEl(
      "div",
      { class: "char-header" },
      writerWrap,
      mkEl(
        "div",
        { class: "char-meta" },
        mkEl("div", { class: "char-big" }, c.char),
        c.pinyin ? mkEl("div", { class: "char-pinyin" }, c.pinyin) : null,
        c.definitions && c.definitions.length
          ? mkEl("div", { class: "char-defs" }, c.definitions.join("; "))
          : null,
      ),
    );
    section.append(header);

    // Etymology
    if (c.notes || c.originalMeaning) {
      section.append(mkEl("div", { class: "section-title" }, "Etymology"));
      const etym = mkEl("div", { class: "etym" });
      if (c.originalMeaning && c.originalMeaning !== "characterless component") {
        etym.append(mkEl("div", { class: "orig" }, `Original meaning: ${c.originalMeaning}`));
      }
      if (c.notes) etym.append(mkEl("div", {}, c.notes));
      section.append(etym);
    }

    // Components
    if (c.components && c.components.length) {
      section.append(mkEl("div", { class: "section-title" }, "Components"));
      const list = mkEl("div", { class: "components" });
      for (const comp of c.components) {
        list.append(renderComponentRow(comp));
      }
      section.append(list);
    }

    // Also appears in — exclude the character itself's word-presence ambiguity;
    // only show other seed words that reference this char.
    if (c.appearsIn && c.appearsIn.length) {
      const currentTopWord =
        state.stack[state.stack.length - 1]?.kind === "word"
          ? state.stack[state.stack.length - 1].key
          : null;
      const others = c.appearsIn.filter((w) => w !== currentTopWord);
      if (others.length) {
        section.append(mkEl("div", { class: "section-title" }, "Also appears in"));
        const chips = mkEl("div", { class: "appears-in" });
        for (const w of others) {
          const wordObj = findWord(w);
          chips.append(
            mkEl(
              "button",
              { class: "chip", type: "button", onclick: () => openWord(w) },
              `${w}${wordObj ? ` · ${wordObj.pinyin}` : ""}`,
            ),
          );
        }
        section.append(chips);
      }
    }

    // My story (mnemonic)
    section.append(mkEl("div", { class: "section-title" }, "My story"));
    section.append(renderMnemonic(charKey));

    return section;
  }

  function renderComponentRow(comp) {
    const role = ROLE_LABEL[comp.type] || "Component";
    const hasData = comp.char !== CHARACTERLESS && !!state.data.chars[comp.char];
    const clickable = hasData;

    const info = mkEl(
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
    );

    return mkEl(
      "button",
      {
        class: `component-row${clickable ? "" : " inert"}`,
        type: "button",
        disabled: clickable ? null : "disabled",
        onclick: clickable ? () => openChar(comp.char) : null,
      },
      mkEl("span", { class: `component-char role-${comp.type}` }, comp.char),
      info,
    );
  }

  // ---------- mnemonic ----------

  function renderMnemonic(charKey) {
    const storageKey = `chinese.mnemonic.${charKey}`;
    const existing = localStorage.getItem(storageKey) || "";
    let saveTimer = null;

    const ta = mkEl("textarea", {
      placeholder:
        "Write your own mnemonic — a short story connecting the character's shape, components, and meaning. The more vivid and personal, the stickier it gets.",
      value: existing,
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

  // ---------- hanzi-writer attachment ----------

  function attachWriter(el) {
    const ch = el.dataset.char;
    if (!ch) return;
    el.innerHTML = "";
    if (typeof HanziWriter === "undefined") {
      el.append(mkEl("div", { class: "writer-fallback" }, ch));
      return;
    }
    try {
      const writer = HanziWriter.create(el, ch, {
        width: 150,
        height: 150,
        padding: 8,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 120,
        strokeColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim() || "#222",
        outlineColor: getComputedStyle(document.documentElement)
          .getPropertyValue("--border")
          .trim() || "#ddd",
        onLoadCharDataError: () => {
          el.innerHTML = "";
          el.append(mkEl("div", { class: "writer-fallback" }, ch));
        },
      });
      writer.loopCharacterAnimation();
      state.writers.push(writer);
      const replay = mkEl(
        "button",
        {
          class: "replay-btn",
          type: "button",
          onclick: (e) => {
            e.stopPropagation();
            writer.animateCharacter();
          },
        },
        "↻ Replay",
      );
      el.append(replay);
    } catch (e) {
      console.error("HanziWriter error for", ch, e);
      el.append(mkEl("div", { class: "writer-fallback" }, ch));
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
    // If we popped into an intermediate state (after nested details), hash may still be present.
    if (state.stack.length === 0) closeModal();
    else renderModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && state.stack.length > 0) popEntry(false);
  });

  // Dismiss on backdrop tap (when body is clicked outside the header/section content is tricky;
  // we just let back button / Esc / swipe-back handle it on mobile).

  // ---------- boot ----------

  (async function boot() {
    await loadData();
    renderGrid();

    // Deep-link: open entry for initial hash, if present and valid.
    const initial = parseHash();
    if (initial) {
      if (initial.kind === "word" && findWord(initial.key)) openWord(initial.key);
      else if (initial.kind === "char" && state.data.chars[initial.key]) openChar(initial.key);
    }
  })();
})();
