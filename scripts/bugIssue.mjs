// Pure formatters that turn a `bug_reports` row into a GitHub issue title +
// body. Dependency-free and side-effect-free so
// scripts/test-bug-report-issue.mjs can import them directly (same pattern as
// componentSearch.mjs). The IO — reading Supabase, creating the issue — lives
// in scripts/sync-bug-reports.mjs.

export const BUG_LABEL = "bug-report";

function oneLine(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

export function issueTitle(report) {
  const ctx = report.context || {};
  const note = oneLine(report.note) || "(no description)";
  const short = note.length > 72 ? note.slice(0, 71) + "…" : note;
  const page = ctx.page ? oneLine(ctx.page) : "";
  return page ? `[bug] ${short} · ${page}` : `[bug] ${short}`;
}

export function issueBody(report) {
  const ctx = report.context || {};
  const rows = [
    ["Page", ctx.page],
    ["Route", ctx.hash],
    ["Word / char", ctx.entity],
    ["Version", ctx.version],
    ["Viewport", ctx.viewport],
    ["Device", ctx.userAgent],
    ["Language", ctx.language],
    ["Installed PWA", boolLabel(ctx.standalone)],
    ["Online", boolLabel(ctx.online)],
    ["Reported at", ctx.timestamp],
    ["Reporter", report.user_id || "anonymous"],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  const table = rows
    .map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, "\\|")} |`)
    .join("\n");
  const note = oneLine(report.note) ? String(report.note).trim() : "_(no description provided)_";

  return [
    "**Reported from the app's 🐞 button.**",
    "",
    note,
    "",
    "| Context | |",
    "|---|---|",
    table,
    "",
    `<sub>Auto-filed from Supabase \`bug_reports\` · report \`${report.id}\`` +
      `${report.created_at ? ` · ${report.created_at}` : ""}</sub>`,
  ].join("\n");
}

function boolLabel(v) {
  if (v === true) return "yes";
  if (v === false) return "no";
  return undefined;
}
