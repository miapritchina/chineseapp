import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { decodeWords, looksLikeShareToken } from "../lib/share";
import type { useSaved } from "./useSaved";

// Three one-shot import side-effects that run on first load after auth
// has settled. Lives outside App.tsx so the shell stays focused on
// rendering. Each effect dedupes via its own ref so it never fires
// twice in a session (Strict mode included), and rewrites the URL to
// strip its param when done.
//
//   ?import=<same-origin-json-url>  → fetch a saved-words file and merge
//   ?share=<token|inline-encoded>   → resolve a share link and merge
//   ?clear=1                        → wipe the saved set across devices
//
// All UI confirmations are window-level (alert/confirm/prompt) to keep
// the surface dependency-free; the underlying saved hook owns the
// Supabase + localStorage writes.

type SavedHook = ReturnType<typeof useSaved>;

export function useAutoImport(opts: { saved: SavedHook; authLoading: boolean }) {
  const { saved, authLoading } = opts;

  // ?import=<url>
  const importRan = useRef(false);
  useEffect(() => {
    if (importRan.current || authLoading) return;
    importRan.current = true;
    const params = new URLSearchParams(window.location.search);
    const importUrl = params.get("import");
    if (!importUrl) return;
    void (async () => {
      try {
        const target = new URL(importUrl, window.location.href);
        if (target.origin !== window.location.origin) {
          alert("Import URL must be same-origin.");
          return;
        }
        const resp = await fetch(target.toString());
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json: unknown = await resp.json();
        let items: string[] | null = null;
        if (Array.isArray(json)) {
          items = json.filter((x): x is string => typeof x === "string");
        } else if (
          json &&
          typeof json === "object" &&
          Array.isArray((json as { saved?: unknown }).saved)
        ) {
          items = (json as { saved: unknown[] }).saved.filter(
            (x): x is string => typeof x === "string",
          );
        }
        if (!items || items.length === 0) {
          alert("Import URL did not return a valid saved-words file.");
          return;
        }
        const ok = window.confirm(
          `Import ${items.length} word${items.length === 1 ? "" : "s"} into your saved list?`,
        );
        if (!ok) return;
        const { added, total } = await saved.importSaved(items);
        const skipped = total - added;
        const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
        alert(`Imported ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Import failed: ${message}`);
      } finally {
        stripParam("import");
      }
    })();
  }, [authLoading, saved]);

  // ?share=<token|inline>
  const shareRan = useRef(false);
  useEffect(() => {
    if (shareRan.current || authLoading) return;
    shareRan.current = true;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("share");
    if (!value) return;
    void (async () => {
      try {
        let items: string[] | null = null;
        if (looksLikeShareToken(value)) {
          // Profile link (v110): resolve to the sharer's LIVE saved
          // set. Falls back to the pre-v110 snapshot RPC when the new
          // function isn't deployed yet, then to inline decode.
          for (const fn of ["get_profile_words", "get_shared_words"]) {
            try {
              const { data, error } = await supabase.rpc(fn, { p_token: value });
              if (!error && Array.isArray(data)) {
                const list = (data as unknown[]).filter(
                  (x): x is string => typeof x === "string" && x.length > 0,
                );
                if (list.length > 0) {
                  items = list;
                  break;
                }
              }
            } catch {
              /* RPC missing, offline, etc. — try the next resolver */
            }
          }
        }
        if (!items) items = decodeWords(value);
        if (!items) {
          alert("This share link looks broken, expired, or empty.");
          return;
        }
        const ok = window.confirm(
          `Someone shared their profile — ${items.length} word${items.length === 1 ? "" : "s"}. Add them to your saved list?`,
        );
        if (!ok) return;
        const { added, total } = await saved.importSaved(items);
        const skipped = total - added;
        const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
        alert(`Added ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
      } finally {
        stripParam("share");
      }
    })();
  }, [authLoading, saved]);

  // ?clear=1
  const clearRan = useRef(false);
  useEffect(() => {
    if (clearRan.current || authLoading) return;
    clearRan.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("clear") !== "1") return;
    void (async () => {
      const ok = window.confirm(
        "Clear ALL your saved words? This removes them from this device and (if you're signed in) from your account on every device. This cannot be undone.",
      );
      if (ok) {
        const { cleared } = await saved.clearAll();
        alert(`Cleared ${cleared} saved word${cleared === 1 ? "" : "s"}.`);
      }
      stripParam("clear");
    })();
  }, [authLoading, saved]);
}

function stripParam(name: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  window.history.replaceState({}, "", url.toString());
}
