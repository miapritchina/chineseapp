# Product specs

UX redesign work, QA findings, and owner interviews. Status of each
doc is called out below — some are active specs being implemented,
others are reference snapshots.

## Active specs

These describe work the project intends to do. Treat as authoritative
until superseded.

- **[`chinese-app-ux-redesign.md`](chinese-app-ux-redesign.md)** —
  Owner interview + QA-driven redesign, May 12 2026. Introduces the
  `<Entity>` component primitive (one component, four sizes), the
  three-tab home page (Dictionary / My Words by Component / Sentence),
  the typography overhaul, the M→P card-type mapping, and 4G of
  specific UX fixes. **Primary source for in-flight UI work.**

- **[`qa-fix-prompt.md`](qa-fix-prompt.md)** — v84 QA findings: 4 bugs
  + 12 UX improvements, prioritized. Overlaps with the redesign spec
  but is narrower and tactical. Use for quick-win fixes; the redesign
  spec for the larger arc.

## Reference

- **[`card-type-catalog.html`](card-type-catalog.html)** — Visual
  inventory of every existing card type (M1–M16) and the proposed
  `<Entity>` variants (P1–P5), with the M→P mapping table. Open in a
  browser. The redesign spec links here.

- **`Chinese_App_QA_Report.pdf`** — Full QA report (48 tests across v84).
  Source for the issues called out in `qa-fix-prompt.md`.

## How these relate

```
Chinese_App_QA_Report.pdf  ──▶  qa-fix-prompt.md  ──┐
                                                    ├──▶  in-flight code work
chinese-app-ux-redesign.md  ◀── card-type-catalog.html
       (broader spec)
```

When you implement a change covered by either spec, update the spec
in the same commit — mark the section as Done or move it to a
"Shipped" subheading — so it stops being a moving target.
