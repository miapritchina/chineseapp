import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// Automated token documentation: reads the *live* computed values of the
// custom properties shipped in styles.css, so this page can never drift
// from the code. Token name lists mirror the groups in
// docs/design-system/DESIGN-SYSTEM.md §2–§3.

const COLOR_GROUPS: Record<string, string[]> = {
  Core: ["--bg", "--surface", "--surface-2", "--text", "--muted", "--border", "--accent"],
  Roles: [
    "--role-word",
    "--role-iconic",
    "--role-meaning",
    "--role-sound",
    "--role-remnant",
    "--role-simplified",
    "--role-deleted",
    "--role-distinguishing",
    "--role-unknown",
  ],
  Status: ["--status-saved", "--status-review", "--status-learned", "--status-wrote"],
  Grades: ["--grade-again", "--grade-hard", "--grade-good", "--grade-easy"],
  POS: [
    "--pos-n",
    "--pos-v",
    "--pos-adj",
    "--pos-adv",
    "--pos-pron",
    "--pos-conj",
    "--pos-part",
    "--pos-c",
  ],
};

const TYPE_TOKENS = [
  "--hanzi-hero",
  "--hanzi-large",
  "--hanzi-medium",
  "--hanzi-small",
  "--heading-1",
  "--heading-2",
  "--body",
  "--caption",
];

function useToken(name: string): string {
  const [v, setV] = useState("");
  useEffect(() => {
    setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);
  return v;
}

function Swatch({ token }: { token: string }) {
  const value = useToken(token);
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: `var(${token})`,
          border: "1px solid var(--border)",
          flex: "none",
        }}
      />
      <code style={{ minWidth: 190 }}>{token}</code>
      <span style={{ color: "var(--muted)" }}>{value}</span>
    </div>
  );
}

function TokenGallery() {
  return (
    <div style={{ display: "grid", gap: 28, padding: 24, maxWidth: 560 }}>
      {Object.entries(COLOR_GROUPS).map(([group, tokens]) => (
        <section key={group}>
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {group}
          </h3>
          <div style={{ display: "grid", gap: 6 }}>
            {tokens.map((t) => (
              <Swatch key={t} token={t} />
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3
          style={{ margin: "0 0 10px", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}
        >
          Type scale
        </h3>
        <div style={{ display: "grid", gap: 8 }}>
          {TYPE_TOKENS.map((t) => (
            <TypeRow key={t} token={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TypeRow({ token }: { token: string }) {
  const value = useToken(token);
  if (!value) return null;
  const sample = token.startsWith("--hanzi") ? "中文" : "The quick brown fox";
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <code style={{ minWidth: 150, fontSize: 12 }}>{token}</code>
      <span style={{ color: "var(--muted)", minWidth: 50, fontSize: 12 }}>{value}</span>
      <span style={{ fontSize: `var(${token})`, lineHeight: 1.1, whiteSpace: "nowrap" }}>
        {sample}
      </span>
    </div>
  );
}

const meta = {
  title: "Design System/Tokens",
  component: TokenGallery,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TokenGallery>;
export default meta;

export const Tokens: StoryObj<typeof meta> = {};
