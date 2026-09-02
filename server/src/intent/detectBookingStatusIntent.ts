const BOOKING_STATUS_KEYWORDS = [
  "my booking", "my reservation", "booking status", "reservation status",
  "is my booking", "check my booking", "booking confirmed", "am i booked",
  "my room booking", "status of my booking", "my order status",
];

// "Can I CANCEL my booking?" / "I want to MODIFY my booking" contain "my
// booking" too, but they're asking about an ACTION (governed by a policy
// FAQ, e.g. the cancellation policy), not "what is the current status of
// my booking." Without this exclusion, those questions got swallowed into
// a repeat of the booking-status lookup instead of answering what was
// actually asked.
const ACTION_WORDS = ["cancel", "modify", "change", "reschedule", "amend", "update", "edit"];

export function isBookingStatusQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (ACTION_WORDS.some((w) => lower.includes(w))) return false;
  return BOOKING_STATUS_KEYWORDS.some((kw) => lower.includes(kw));
}
