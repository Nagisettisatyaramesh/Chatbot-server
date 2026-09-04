# Connecting your own database to the chatbot

If your business already has its own backend (a booking system, an
inventory database, an appointment scheduler), the chatbot can answer
questions from it directly -- real availability, real booking status --
instead of guessing from your website's text.

To enable this, your backend implements **two read-only endpoints**
matching the shapes below, then you enter your backend's base URL in the
admin portal. No code changes on our side, and no code changes to your
existing systems beyond adding these two endpoints.

This is intentionally generic (it works whether you're a hotel, a salon,
an event venue, or a rental service) -- pick whatever field values make
sense for your business, following the shapes exactly.

## 1. Look up one booking by reference code

```
GET {your-base-url}/booking/{reference}
```

The `reference` is whatever confirmation code you already give customers
(a booking number, an order ID, a PNR-style code) -- **never a customer's
name**. This is a deliberate security requirement: a stranger typing a
guest's name into the chat must never be able to see that guest's
booking. Only someone who already has the reference code can look it up.

**Response, 200 OK, when found:**

```json
{
  "reference": "HB-D7VDEZ",
  "label": "Classic Room, Room 402",
  "startDate": "2026-08-20",
  "endDate": "2026-08-21",
  "status": "confirmed",
  "quantity": 1
}
```

| Field       | Type            | Required | Meaning                                                              |
|-------------|-----------------|----------|-----------------------------------------------------------------------|
| `reference` | string          | yes      | Echo back the reference that was looked up                            |
| `label`     | string          | yes      | Human-readable description of what was booked (shown to the customer) |
| `startDate` | string (ISO date) | yes    | Check-in / appointment date / start of the booking                    |
| `endDate`   | string (ISO date) | no     | Omit for bookings with no end date (e.g. a single appointment slot)   |
| `status`    | string          | yes      | Free text, e.g. `confirmed`, `pending`, `cancelled`, `completed`      |
| `quantity`  | number          | no       | Guests / seats / units, if relevant to your business                  |

**When not found:** respond `404` with any body (or none) -- the chatbot
shows a generic "couldn't find that booking" message either way.

## 2. List what you currently offer

```
GET {your-base-url}/inventory
```

**Response, 200 OK:**

```json
[
  {
    "id": "deluxe-room",
    "name": "Deluxe Room",
    "description": "Extra space and a refined finish.",
    "price": "2000.00",
    "tags": ["Air Conditioning", "Free WiFi", "Minibar"],
    "availableCount": 14
  }
]
```

| Field            | Type     | Required | Meaning                                                  |
|------------------|----------|----------|-----------------------------------------------------------|
| `id`             | string   | yes      | Any stable identifier                                      |
| `name`           | string   | yes      | What a customer would call it (room type, service, item)   |
| `description`    | string   | no       | A sentence or two about it                                 |
| `price`          | string   | no       | Shown as-is; include currency if you want it displayed     |
| `tags`           | string[] | no       | Features/amenities, shown as a list                        |
| `availableCount` | number   | no       | Current availability. Omit if you don't track this         |

Return this list fresh on every request -- the chatbot does not cache it
for more than a minute, so availability stays current.

## Setting it up

Enter your base URL (e.g. `https://api.yourbusiness.com`) in the
**"Live data API URL"** field under Advanced settings when you register,
or add it later from the admin portal. That's the only step on your end
beyond building the two endpoints above.

## What you get automatically once this is connected

- "Is the [X] available?" and "what do you have available?" answer from
  your real `/inventory` data, not from guessing at your website's text.
- "What's the status of booking [code]?" looks it up via `/booking/:reference`
  and answers with the real status -- never by name, only by the
  reference code the customer already has.
- If your backend is unreachable, the chatbot fails soft -- it falls back
  to your knowledge articles and website content rather than erroring out
  to the customer.
