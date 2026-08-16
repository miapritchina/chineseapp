// "Just start" flow (v114, owner request): one tap builds the whole
// session — the normal mixed drills, then a couple of new words to
// finish on a teaching note. Each stage auto-advances into the next
// when its deck drains. Sift was dropped from the chain in v123: it's
// a triage tool for sifting out too-simple words, launched on its own,
// not part of a workout.

export type FlowStage = "review" | "learn";

export const LEARN_STAGE_COUNT = 2;

export function planFlow(learnCount: number): FlowStage[] {
  const stages: FlowStage[] = ["review"];
  if (learnCount > 0) stages.push("learn");
  return stages;
}
