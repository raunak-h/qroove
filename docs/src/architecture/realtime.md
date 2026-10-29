# Realtime

`GET /api/events/:id/stream` is a Server-Sent Events stream. On connect it sends `event: state` with the public
view; after every committed change it sends another `state` event with the new view. A `: keep-alive` comment
goes out every 20 seconds, and the client is told to retry after 3 seconds. `GET …/admin/stream` is the same
stream for admins, carrying the moderation list.

## How a change reaches clients

1. A command commits and bumps `EventDoc.version`.
2. The repository's `subscribe` callback fires (the memory adapter after commit; Firestore through `onSnapshot`).
3. `EventBus` loads the aggregate **once** and renders it for each connected client. Changes arriving during a
   load are coalesced. Heartbeats do not bump `version`, so they cause no traffic.

One Firestore subscription exists per event with at least one client, and it is dropped when the last client
leaves. Reads per change scale with the number of requests, not clients.

## Clients

The page falls back to polling `GET /api/events/:slug/public` every 10 seconds when the stream fails (Phase 5).
Personal data ("my next song") is derived on the client from the public preview plus the participant's own
`my-requests` ids, so the stream never contains owner ids. Countdowns tick locally from `serverNow`.

The 4 KB message budget in the plan was dropped: a full view is pushed instead of a bare revision, which keeps
the client simple. The queue is capped at 50 items.
