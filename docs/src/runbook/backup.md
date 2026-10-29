# Backup and retention

## What is kept, and for how long

The server runs a retention purge when it starts and every 6 hours (a Railway cron service would cost
extra, and production runs a single instance). It can also be triggered from outside.

| Data                                                | Deleted                                  |
| --------------------------------------------------- | ---------------------------------------- |
| Abandoned `DRAFT` events (whole event and its slug) | 7 days after creation                    |
| Participants: token hashes and nicknames            | 30 days after the event ended            |
| Audit records                                       | 90 days after they were written          |
| Idempotency records                                 | 24 hours (Firestore TTL needs billing)   |
| Songs, styles and play history of an ended event    | Kept, as an anonymised playlist snapshot |

The purge is idempotent. Run it by hand with the shared secret (the route is absent when `CRON_SECRET` is
unset):

```sh
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://qroove.sataklela.com/api/internal/purge
# {"draftsDeleted":0,"participantsDeleted":3,"auditDeleted":120,"idempotencyDeleted":40}
```

The cut-offs live in `apps/server/src/maintenance/purge.ts`; the privacy page and this table must change
with them.

## Backups

Scheduled Firestore exports (`gcloud firestore export`) need the Blaze plan, which this project does not use.
The free alternative is per-event JSON, which contains songs, styles and order and no people:

- Organiser: the played-and-unplayed list from `GET /api/events/:id/export` (also the "Download as JSON"
  button on a past event's page `/h/<code>`).
- Restoring: `/import` accepts that file and creates a new event with the chosen songs (they follow the
  normal fairness rules; played history is not restored).

A deleted or lost live event cannot be restored to its exact state; the export is a playlist, not a
database dump. If that is not acceptable for a given event, export the JSON before it starts and again
when it ends. To move to Blaze later, add a scheduled `gcloud firestore export` to a Cloud Storage bucket.
