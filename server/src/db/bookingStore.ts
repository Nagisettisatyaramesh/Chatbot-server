import fs from "fs";
import path from "path";

export interface Booking {
  bookingId: string;
  userId: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guests: number;
}

const DATA_DIR = path.resolve(__dirname, "../../data/bookings");

function loadBookings(websiteId: string): Booking[] {
  const safeId = websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, `${safeId}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Scoped by BOTH websiteId and userId -- a logged-in visitor can only ever
// see their own bookings on the website they're logged into, never
// another guest's, and never another website's booking records.
export function getBookingsForUser(websiteId: string, userId: string): Booking[] {
  return loadBookings(websiteId).filter((b) => b.userId === userId);
}
