// One-stop wrapper for Supabase async results that follow the
// `{ data, error }` envelope. Logs errors with a label and swallows
// them, so callers can degrade to the local cache without per-call
// boilerplate. Matches the pattern that was previously inlined in
// useSaved / useMnemonics / useReview.
//
// `ignoreMatch` lets callers silence "expected" errors — typically the
// "relation does not exist" message thrown when a migration hasn't been
// applied yet (additive-migration policy, ADR-0005).

import type { PostgrestError } from "@supabase/supabase-js";

export interface PgResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

export async function withErrorLog<T>(
  label: string,
  promise: PromiseLike<PgResult<T>>,
  options?: { ignoreMatch?: RegExp },
): Promise<T | null> {
  try {
    const { data, error } = await promise;
    if (error) {
      if (options?.ignoreMatch && options.ignoreMatch.test(error.message || "")) {
        return null;
      }
      console.error(`${label} failed:`, error);
      return null;
    }
    return data;
  } catch (e) {
    console.error(`${label} threw:`, e);
    return null;
  }
}

// Fire-and-forget variant. For writes where the UI has already updated
// optimistically and we just want the error logged.
export function logAndForget(
  label: string,
  promise: PromiseLike<{ error: PostgrestError | null }>,
  options?: { ignoreMatch?: RegExp },
): void {
  void Promise.resolve(promise).then(({ error }) => {
    if (!error) return;
    if (options?.ignoreMatch && options.ignoreMatch.test(error.message || "")) return;
    console.error(`${label} failed:`, error);
  });
}
