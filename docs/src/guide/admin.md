# Organiser guide

You run an event from your phone. There is no account: control belongs to whoever holds the organiser link.

## Create an event

Open **Create an event** from the home page (`/new`). Pick a template or fill in the form:

![Creating an event](/screens/admin-create.png){width=280}

- **Templates:** _Friday Social_ (name, and an end time of 21:00 today if that is still ahead) and _Dance break_
  (10 or 20 minutes from now). Everything stays editable.
- **Planned end time** is optional. With one, songs that cannot finish before it are marked _After end time_.
  Times use your device's time zone.
- **Styles and caps:** at least two styles, and the most songs of one style in a row (default 2 for Salsa and
  Bachata, 1 for others).
- **Accepted songs per person** (default 5).
- **Breaks:** optional 10- or 20-minute breaks to start and end during the event.
- The **spacing rule** is fixed: nobody plays twice in a row, and not again until the style has changed once.

## Save the organiser link

![The link is shown once](/screens/admin-created.png){width=280}

The organiser link is shown **once**. Copy it somewhere private. Anyone with it can run the event, so do not post
it where attendees can see it. The **recovery secret** under it restores access if the link is lost; keep it
separately. The join code and public link are different and safe to share.

Opening the link signs this browser in and then removes the secret from the address bar.

## Run the event

![The organiser page](/screens/admin-dashboard.png){width=280}

- **Start event** locks the rules. After that nothing on the page changes them.
- **Playback:** what is playing, what is next, the style run, and why the queue is waiting if it is. **Pause**
  keeps the next song reserved; **Resume** carries on. **Skip** (with confirmation) ends the current song; it still
  counts as played for fairness and for its owner's quota.
- **Moderation:** every request with its contributor's nickname and a short tag (`#B7BD`). **Remove** (with
  confirmation) frees that person's slot. Songs that already played cannot be removed, so nobody can erase the
  history. A song marked _Possible duplicate_ is held until you choose **Distinct** (let it in) or **Reject**.
- **End time and breaks:** extend to a real clock time later than the current end, or set one if there was none.
  Start and end breaks here; no song starts during a break.
- **Invite people:** a QR code and the large event code for the public join link. It never contains organiser access.
- **Player:** shows whether a device is controlling playback and links to the player.
- **Rules:** read-only, with a short fingerprint of the locked rules.

## Hand over to someone else

**Hand over admin** creates a link that works once, for 10 minutes. Send it privately. When the new organiser
opens it, your access ends immediately, playback pauses, the song in progress counts as played, and they resume
when ready. Changed your mind? Use **Cancel handover and resume**.

If you lose access (a handover, a cleared browser, a lost link) open the organiser page and enter the **recovery
secret**.

## End the event

Type `END` to confirm. Ending is permanent. Songs that never played appear under **Carry over to a new event**:
choose which to keep, optionally shuffle within each style, and create the next event. The copies belong to a
neutral "system" contributor that follows the same fairness rules, and you can remove any before starting. The new
event has its own organiser link.

## Past events

`/h/<code>` shows a read-only playlist of everything requested at an event: titles, artists and styles, no names.
