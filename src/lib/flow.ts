// "Just start" flow (v114, owner request): one tap builds the whole
// session — triage the backlog first while it's fat, then the normal
// mixed drills, then a couple of new words to finish on a teaching
// note. Each stage auto-advances into the next when its deck drains.

export type FlowStage = "sift" | "review" | "learn";

// Sift only leads when there's a real backlog to clear…
export const SIFT_FLOW_MIN = 20;
// …and stays a quick pass, not the whole session.
export const SIFT_STAGE_CAP = 15;
export const LEARN_STAGE_COUNT = 2;

export function planFlow(siftCount: number, learnCount: number): FlowStage[] {
  const stages: FlowStage[] = [];
  if (siftCount >= SIFT_FLOW_MIN) stages.push("sift");
  stages.push("review");
  if (learnCount > 0) stages.push("learn");
  return stages;
}
