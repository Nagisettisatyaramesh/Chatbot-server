// Pulls a booking-reference-shaped token out of free text, e.g. "HB-D7VDEZ"
// out of "my reference is HB-D7VDEZ" or even a bare "HB-D7VDEZ" with no
// other words. This is what lets a real hotel's own reference codes (handed
// to the guest at booking time) work as the identity credential for a
// booking-status lookup, instead of a name (which anyone could type).
//
// Requires a digit somewhere after the hyphen -- ordinary hyphenated English
// words a guest might type ("non-smoking", "self-service", "front-desk")
// never contain one, so this avoids misreading them as a reference code.
const REFERENCE_PATTERN = /\b[a-z]{2,5}-(?=[a-z0-9]{4,10}\b)(?=[a-z0-9]*\d)[a-z0-9]+\b/i;

export function extractBookingReference(message: string): string | null {
  const match = message.match(REFERENCE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}
