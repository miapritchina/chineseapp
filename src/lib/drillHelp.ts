// Per-drill instructions shown behind the header "?" popover (DrillHelp).
// These replaced the transient on-card "tap to reveal / continue …"
// hints that flickered on every reveal (owner request, v150): the guidance
// is one tap away instead of moving text on the surface. Keep each to a
// sentence or two — the popover is small.
export const DRILL_HELP = {
  recognition:
    "Tap the card to reveal the pinyin and meaning, then rate how well you knew each. Rating is optional — you can just tap through.",
  flashcards:
    "Each card reads itself aloud (turn Sound off in review settings to mute). Tap to flip, tap again for the next one. Rating is optional — this deck is just for a relaxed look.",
  newWord:
    "A word you haven't saved yet, built from characters you already know. Pick its meaning (or build it from the tray), then tap anywhere to move on.",
  reverse: "Read the meaning, then tap the character that matches. Tap anywhere for the next card.",
  cloze:
    "One character is hidden (▢). Tap the one that fills the gap, then tap anywhere to continue.",
  familySweep:
    "Tap every character that contains the shown component, then Check. It's a game — nothing is graded.",
  write:
    "Write the character for the meaning shown — trace each stroke in order. Tap anywhere when you're done.",
  cluster:
    "A group of related words. Tap each to reveal it, mark any you missed with ✗, then Continue.",
  confusable:
    "Two look-alikes shown side by side. Note what's different between them, then Continue.",
} as const;
