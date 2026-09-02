// Deterministic small-talk handling -- NOT a knowledge lookup. Greetings,
// thanks, and goodbyes aren't factual claims, so responding to them isn't
// "guessing"; but without this, a plain "hi" fell through to the same
// "I don't have enough information... Call Us" fallback as a genuinely
// unanswerable question, which reads as broken to a real visitor.
//
// Matching is exact-after-normalization (lowercase, trim, strip trailing
// punctuation) rather than substring matching, specifically so a real
// question that happens to start with "hi" (e.g. "hi, do you have a gym?")
// still falls through to normal knowledge/website/database matching
// instead of being swallowed as small talk.
function normalize(message: string): string {
  return message.toLowerCase().trim().replace(/[!?.]+$/g, "").trim();
}

const GREETINGS = new Set([
  "hi", "hello", "hey", "yo", "hiya", "hi there", "hello there", "hey there",
  "good morning", "good afternoon", "good evening", "greetings", "howdy",
]);

const THANKS = new Set([
  "thanks", "thank you", "thank u", "thx", "ty", "much appreciated",
  "appreciate it", "thanks a lot", "thank you so much", "great thanks",
]);

const GOODBYES = new Set([
  "bye", "goodbye", "bye bye", "see you", "see ya", "good night", "take care", "later",
]);

export function detectSmallTalk(message: string): string | null {
  const norm = normalize(message);
  if (GREETINGS.has(norm)) return "Hi! How can I help you today?";
  if (THANKS.has(norm)) return "You're welcome! Let me know if you have any other questions.";
  if (GOODBYES.has(norm)) return "Thank you for chatting with us! Have a great day.";
  return null;
}
