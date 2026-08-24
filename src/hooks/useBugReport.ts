import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { BugContext } from "../lib/bugReport";

type SubmitStatus = "idle" | "sending" | "sent" | "error";

// Write-only: bug reports are the source of truth in Supabase (no local
// mirror — the reporter never reads them back in the app). A failed insert
// surfaces as "error" so the user can retry rather than losing the report.
export function useBugReport(userId: string | null) {
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const submit = async (note: string, context: BugContext) => {
    setStatus("sending");
    const { error } = await supabase.from("bug_reports").insert({ user_id: userId, note, context });
    setStatus(error ? "error" : "sent");
    return !error;
  };

  return { status, submit, reset: () => setStatus("idle") };
}
