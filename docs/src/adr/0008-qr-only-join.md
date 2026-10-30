# ADR 0008 — Joining needs a secret carried by the QR code

**Status:** superseded by [ADR 0015](/adr/0015-permanent-room-code) · **Date:** 2026-10-29

## Context

A six-character room code can be read out over the phone, letting someone who is not in the room join and affect the queue.

## Decision

Each event has a random join key stored on the event and shown only inside the organiser's QR code (`/e/CODE#j=KEY`, in the fragment so it is never sent in a request line or logged). `POST /join` requires the key (constant-time compare) and answers `JOIN_KEY_REQUIRED` otherwise. The key is scrubbed from the address bar and kept in the tab's session storage. The landing page code box only confirms an event exists and tells the visitor to scan. The organiser screen shows no text code or link and has no copy button; right-click and text selection are disabled on organiser, attendee and player pages as a deterrent only. The queue view stays readable by code, since it contains song titles only.

## Consequences

Someone who photographs the QR can still join, which matches being in the room. The key does not rotate in this release. Disabling right-click does not stop a determined person on an unlocked device; the organiser session is HttpOnly and handover or recovery revokes it.
