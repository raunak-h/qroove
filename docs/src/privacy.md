# Privacy

Qroove needs no account. This page says what is stored and for how long.

## What is stored

| Data                                            | Why                                      | Notes                                       |
| ----------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| A random participant id and a hash of its token | So you can see and remove your own songs | The token itself lives only in your browser |
| Optional nickname                               | Shown next to your songs                 | Not unique; you can leave it blank          |
| Songs you request (title, artist, style, link)  | To run the queue                         | Link tracking parameters are stripped       |
| Audit records                                   | To resolve disputes                      | Actions and ids; never secrets              |
| Your IP address                                 | Rate limiting, in server memory only     | Not written to the database                 |

No audio is stored, uploaded or streamed by Qroove. There are no advertising or analytics trackers.

## Retention

Participant records and nicknames are purged 30 days after an event ends; the purge job arrives in Phase 8.
Exported snapshots contain songs only, never people. Organisers can end an event at any time, which makes it
read-only.

## Third parties

Looking up a song link sends only the song id to Spotify, Apple (iTunes Lookup) or YouTube. Hosting is on
Railway and the database on Google Cloud Firestore (EU multi-region).
