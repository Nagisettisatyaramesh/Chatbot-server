// Requires a SUBJECT word (what the live data tracks) AND an AVAILABILITY
// word to both appear before treating a question as needing live/current
// data. A plain OR-list of generic words (e.g. "book", "available",
// "current") was too eager: "Do I need to pay a deposit at booking?" and
// even an unrelated cross-site question both contain "booking"/"book" and
// got hijacked into the room-availability answer, overriding a much
// better knowledge-base match (or masking that nothing matched at all).
const SUBJECT_WORDS = ["room", "rooms", "slot", "slots", "appointment", "appointments", "table", "tables"];
const AVAILABILITY_WORDS = ["available", "availability", "avail", "vacancy", "vacant", "left", "open", "occupied", "booked up", "free"];

export function needsLiveData(message: string): boolean {
  const lower = message.toLowerCase();
  const hasSubject = SUBJECT_WORDS.some((w) => lower.includes(w));
  const hasAvailability = AVAILABILITY_WORDS.some((w) => lower.includes(w));
  return hasSubject && hasAvailability;
}
