# Organiser guide

You run an event from your phone. There is no account: control belongs to whoever holds the organiser link.

## Create an event

Open **Create an event** from the home page (`/new`).

- **Planned time** works like an oven timer: hours up to 8, then minutes in steps of 10 (at least 10 minutes).
  The clock starts when you press **Start event**; songs that cannot finish before the end are marked _After end time_.
- **Dance styles:** Salsa, Bachata, Cha-cha, and a non-Latin-compatible version of each. A style and its
  non-Latin-compatible version count as one genre, so a change between them is not a style change. One genre is
  enough; with more, spacing is by style change, and with exactly one it is by waiting for half of the other
  people's songs (see [ADR 0009](/adr/0009-single-genre-spacing)).
- **Most songs in a row** is one number for every genre (1 to 5, default 2). Under _Advanced_ you can set a
  ratio instead (parts 1 to 5, for example 1:5 or 1:1:5). No genre may get less than 1 part in 10.
- **Accepted songs per person** (default 5).
- **Breaks:** up to three of 10, 20 or 30 minutes, set now. They sit evenly spread and centred on the planned time
  (one break is on the midpoint), together take at most half of it, and need at least 20 minutes of music around
  them, so breaks can never be back to back. A song only starts if it can finish before the break.
- **Start from a playlist:** paste a public Spotify, YouTube Music, YouTube or Apple Music playlist link. Songs are
  queued in order for the style you pick, up to one minute less than the planned time. These public pages show only
  the first part of long playlists, and sites can change them, so it is best effort; if a link cannot be read you
  can still add songs by hand.

## Save the organiser link

![The link is shown once](/screens/admin-created.png){width=280}

The organiser link is shown **once**. Copy it somewhere private. Anyone with it can run the event, so do not post
it where attendees can see it. The **recovery secret** under it restores access if the link is lost; keep it
separately. Guests do not use this link.

Opening the link signs this browser in and then removes the secret from the address bar.

## Run the event

![The organiser page](/screens/admin-dashboard.png){width=280}

- **Start event** locks the rules. After that nothing on the page changes them.
- **Playback:** what is playing, what is next, the style run, and why the queue is waiting if it is. **Pause**
  keeps the next song reserved; **Resume** carries on. **Skip** (with confirmation) ends the current song; it still
  counts as played for fairness and for its owner's quota.
  The organiser page is one screen with four tabs; only the queue list scrolls.

- **Controls (always visible):** now playing, next, the genre run, why the queue is waiting, **Start / Pause /
  Resume**, **Skip** (two taps; it still counts as played), and **Start break / End break** when a break is due.
- **Queue:** every request with its contributor's tag. **Remove** (two taps) frees that person's slot. A song
  marked _Possible duplicate_ is held until you choose **Distinct** or **Reject**.
- **Invite:** only a QR code. Guests scan it with their camera; the room code alone cannot join, and there is no link
  or copy button. Right-click and text selection are off on this page.
- **Player:** whether a device controls playback, and a link to the player.
- **More:** **Hand over**, **Time** (extend the end), **Rules** (read-only) and **End the event**.

## Hand over to someone else

**Hand over admin** creates a link that works once, for 10 minutes. Send it privately. When the new organiser
opens it, your access ends immediately, playback pauses, the song in progress counts as played, and they resume
when ready. Changed your mind? Use **Cancel handover and resume**.

If you lose access (a handover, a cleared browser, a lost link) open the organiser page and enter the **recovery
secret**.

## End the event

**More → End the event → End event → Yes, end the event now.** Two separate taps, nothing to type. Ending is
permanent. Songs that never played appear under **Queue** as **Carry over to a new event**: choose which to keep,
optionally shuffle within each style, and create the next event with the same planned time. Carried songs fit in
that time minus one minute. The copies belong to a neutral "system" contributor that follows the same fairness
rules, and you can remove any before starting.

## Past events

`/h/<code>` shows a read-only playlist of everything requested at an event: titles, artists and styles, no names.
