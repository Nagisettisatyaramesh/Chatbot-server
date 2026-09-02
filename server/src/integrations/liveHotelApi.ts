// Adapter for a real hotel's own backend API (e.g. Hotel Brinda,
// https://github.com -- an actual Postgres-backed booking system, not a
// demo). When a website config sets `liveApiUrl`, the answer engines call
// through here instead of the local JSON placeholder stores, so answers
// reflect the tenant's REAL bookings and REAL room inventory.
//
// Booking lookup is by REFERENCE CODE only (e.g. "HB-D7VDEZ") -- that code
// is what the hotel's own guest-facing "Find my booking" flow uses, is
// handed to the guest at booking time, and is unguessable. This preserves
// the identity-verification requirement (never look up a stranger's
// booking by typing their name) without needing a separate login system
// that the real hotel doesn't have.

export interface LiveBooking {
  reference: string;
  roomTypeName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guestsCount: number;
}

export interface LiveRoomType {
  id: number;
  name: string;
  description: string;
  basePrice: string;
  amenities: string[];
  availableCount: number;
}

const FETCH_TIMEOUT_MS = 5000;
const ROOM_TYPES_CACHE_TTL_MS = 60 * 1000;
const roomTypesCache = new Map<string, { data: LiveRoomType[]; fetchedAt: number }>();

const STATUS_LABEL: Record<string, string> = {
  pending: "awaiting payment",
  confirmed: "confirmed",
  checked_in: "checked in",
  checked_out: "checked out",
  cancelled: "cancelled",
};

export function formatBookingStatus(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function formatRoomTypeSummary(rt: LiveRoomType): string {
  return `${rt.name}: ${rt.description} Amenities: ${rt.amenities.join(", ") || "none listed"}. Price: ₹${rt.basePrice} per night. Currently ${rt.availableCount} room${rt.availableCount === 1 ? "" : "s"} of this type available.`;
}

// Distinguishes "tell me about the deluxe room" (wants ONE type) from
// "what rooms do you have" (wants ALL of them) -- checked against the
// REAL room type names from the live API, not a hardcoded list, so it
// still works if the hotel renames or adds a room type. Only looks at
// each name's first word (the distinguishing adjective, e.g. "Deluxe" in
// "Deluxe Room") so a generic "rooms" query doesn't itself count as
// naming a specific type.
export function findMentionedRoomType(message: string, roomTypes: LiveRoomType[]): LiveRoomType | null {
  const lower = message.toLowerCase();
  return (
    roomTypes.find((rt) => {
      const firstWord = rt.name.split(/\s+/)[0]?.toLowerCase();
      return !!firstWord && firstWord.length > 2 && lower.includes(firstWord);
    }) ?? null
  );
}

export function mentionsSpecificRoomType(message: string, roomTypes: LiveRoomType[]): boolean {
  return findMentionedRoomType(message, roomTypes) !== null;
}

export async function fetchBookingByReference(apiBaseUrl: string, reference: string): Promise<LiveBooking | null> {
  try {
    const resp = await fetch(`${apiBaseUrl}/api/bookings/${encodeURIComponent(reference)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const b = (await resp.json()) as Record<string, unknown>;
    return {
      reference: b.reference as string,
      roomTypeName: b.room_type_name as string,
      roomNumber: b.room_number as string,
      checkIn: b.check_in as string,
      checkOut: b.check_out as string,
      status: b.status as string,
      guestsCount: b.guests_count as number,
    };
  } catch (err) {
    console.error(`[live-hotel-api] booking lookup failed for ${apiBaseUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchLiveRoomTypes(apiBaseUrl: string): Promise<LiveRoomType[]> {
  const cached = roomTypesCache.get(apiBaseUrl);
  if (cached && Date.now() - cached.fetchedAt < ROOM_TYPES_CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const resp = await fetch(`${apiBaseUrl}/api/room-types`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`room-types responded with ${resp.status}`);
    const rows = (await resp.json()) as Record<string, unknown>[];
    const data: LiveRoomType[] = rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      description: r.description as string,
      basePrice: r.base_price as string,
      amenities: (r.amenities as string[]) ?? [],
      availableCount: (r.available_count as number) ?? 0,
    }));
    roomTypesCache.set(apiBaseUrl, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    console.error(`[live-hotel-api] room-types fetch failed for ${apiBaseUrl}:`, err instanceof Error ? err.message : err);
    return cached?.data ?? [];
  }
}
