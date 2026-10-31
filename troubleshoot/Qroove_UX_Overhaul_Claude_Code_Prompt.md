# Claude Code implementation prompt — Qroove focused visual and UX overhaul

**Model:** Claude Sonnet 5  
**Execution:** Claude Code, from the Qroove repository root  
**Live application:** https://qroove.sataklela.com/  
**Primary objective:** Deliver a cohesive, noticeably more polished Qroove interface by improving the tactile visual design of buttons and interactive controls, while also implementing the specific attendee, playlist, organiser-queue and event-bar refinements listed below.  
**Scope:** A focused product-UX rejig of named screens and components, not a full application redesign. The work is allowed to go beyond buttons where the user feedback explicitly requires it. Preserve the app's existing identity, functionality, data contracts and core event rules.

---

## Your role and working standard

Act as a senior product designer and front-end engineer with strong judgement in interaction design, CSS rendering, responsive PWAs, accessibility and real-world mobile usability. Work directly in the existing repository. Inspect first, implement the changes, run the relevant checks, and leave the code in a finished, reviewable state. Do not stop after producing recommendations or a design audit.

The goal is a joined-up improvement, not a collection of unrelated CSS tweaks. Buttons should feel materially convincing and tactile; attendee song search should be easy to use on an iPhone; playlist actions should give unmistakable feedback and prevent accidental repeat additions; and the organiser should have a much more useful queue view. All of these changes must look and behave as though they belong to the same Qroove product.

Use the live application and repository as the source of truth for the current implementation. Use the functional documentation to understand intended behaviour and constraints. Where a request is ambiguous, inspect the current flow and choose the least invasive implementation that fulfils the feedback without silently changing product rules.

## 1. Start with repository and product reconnaissance

Before changing anything:

1. Run `git status`, identify the current branch and inspect recent relevant changes. Preserve all pre-existing user work. Do not reset, checkout over, discard or reformat unrelated changes. Do not commit, push, deploy or alter production data unless explicitly requested elsewhere in the repository's working instructions.
2. Read the repository's `README`, project instructions (`CLAUDE.md`, `AGENTS.md` or equivalent), design-system notes, component documentation and relevant functional documentation. Locate and read the Qroove/LSU Salsa Society implementation specification if it is present in the repository. The specification describes intended user journeys and invariants; use it to understand the controls, not as permission to change their behaviour.
3. Map the front-end stack, styling approach, existing design tokens, shared components, routes, state-management approach and responsive breakpoints. Identify whether controls are native elements, shared components, utility-class compositions or a mixture. Prefer the existing architecture and conventions.
4. Locate and map these exact UI elements and their current data/state sources:
   - All shared button variants and button-like controls.
   - The attendee song search / “Search or paste a link” input and its result list.
   - The “My Spotify playlist” control and the playlist selection/add flow, including what happens immediately after a successful add and when the user reopens the playlist list.
   - The organiser's active-event view, embedded Spotify player, next-up section and upcoming queue.
   - The event/genre bar, its purple box and the vertical breakpoint marker/bar.
5. Record the real source of the active colour palette, typography, genre colours, purple event-bar styling and breakpoint semantics in the code. Preserve these values and meanings except for the explicitly requested bright-yellow breakpoint marker. Do not invent a new palette or guess what any indicator represents.
6. Inspect the running app visually before editing wherever possible. Prefer the project's existing browser/Playwright workflow or available browser tooling. Capture representative before screenshots at approximately **1440 × 900** and **390 × 844**, including the organiser's active-event view and attendee song-search/playlist flows. Also inspect a narrow mobile viewport and, where relevant, installed-PWA/standalone layout. Use seeded/local test data if available. Never use real attendee data or expose admin capability URLs/tokens in screenshots.

If the production URL cannot be rendered by your available browser tooling, do not pretend that you have visually inspected it. Use the local app and source code as the authoritative basis, and record that limitation in the final report. The supplied live URL is a reference, not a reason to spend time reverse-engineering production infrastructure.

## 2. Scope and non-negotiable boundaries

### In scope — implement all of these

- A coherent, reusable visual system for existing buttons and button-like controls, with believable 3D depth, lighting, highlights, shadows and pressed states.
- Clear hierarchy between primary, secondary, tertiary, icon-only, destructive, toggle/segmented and disabled controls.
- Make **“My Spotify playlist”** unmistakably recognisable as a button/control, styled as a tactile pillbox button while preserving its current action and link/button semantics.
- Fix the attendee song-search input so an iPhone opens a normal text keyboard with a spacebar, not a numeric/URL-oriented keyboard that makes ordinary song-title searches awkward.
- Improve song-search result rows: left-align song listings; distinguish song title and artist visually; show small album-art thumbnails when existing result data already provides artwork.
- Improve the playlist-add flow with clear success feedback, automatic collapse after a successful addition, and a persistent disabled “already added” state at the top of the list when the user revisits it.
- Rework the organiser active-event layout so the upcoming queue fills the remaining usable vertical space, while the next-up summary is reduced to one compact line and redundant currently-playing metadata is removed where the Spotify embed already displays it.
- Make the vertical breakpoint marker inside the right-hand side of the purple event-bar box clearly visible in bright yellow with sharp contrast.
- Refine the existing event/genre bar only where needed to make the above marker and current genre coding clearer. Keep existing genre colour meanings unchanged.
- Small interaction refinements that make controls feel more responsive and predictable: hit-area sizing, alignment, stable dimensions, loading/disabled feedback, focus indication and state transitions.

### Do not do these

- Do not redesign the whole application, change its brand, replace the page layout wholesale or introduce a new visual theme.
- Do not change queue scheduling, fairness rules, genre caps, FIFO/selection behaviour, song ordering, submission quotas, playback rules, event states, admin permissions or handover semantics.
- Do not replace the Spotify embed/player, alter playback integrations, extract audio, bypass DRM or change third-party provider behaviour.
- Do not add user accounts, analytics, tracking, new product features, new workflows or dependencies merely to support the visual refresh.
- Do not change API contracts, database schema, authentication, authorisation, PWA/offline behaviour or service-worker logic for convenience. Prefer existing state and data sources for playlist-added status. If a truly reliable already-added state cannot be implemented from existing data, do not fake it with a fragile display-only flag: document the exact missing capability and the smallest necessary follow-up. A minimal, local UI-state change is allowed; a backend/schema change is not authorised in this task.
- Do not use large decorative artwork, WebGL, canvas, heavy animation libraries, external fonts or image assets for button effects. Prefer CSS, existing icons and existing assets.
- Do not add gratuitous animation, sound effects, pulsing, neon glow, exaggerated glossy plastic, skeuomorphic chrome or oversized shadows. Avoid a toy/game UI aesthetic.
- Do not make every control look like a primary CTA. Preserve visual hierarchy and restraint.

When an improvement appears to require a change to core functionality or a backend contract, preserve the current behaviour and report the blocker rather than expanding the task unilaterally.

## 3. Button visual direction: tactile, restrained, believable

Use one coherent lighting model across the application. Unless the existing design makes this clearly unsuitable, treat the light as coming from the upper-left/front. A raised button should read as a real, softly lit surface resting above the page, not simply a flat rectangle with a large black shadow.

Build the treatment from several subtle layers rather than one dramatic effect:

- **Surface:** a restrained top-to-bottom or multi-stop gradient based on the existing button colour. The top edge can be fractionally lighter; the lower face can be fractionally deeper. Preserve the actual hue and saturation of the brand tokens.
- **Bevel/highlight:** a fine border and restrained inset highlight along the top/upper edge. Use an inset shadow or pseudo-element only where it improves the material. Keep text and icons above any decorative pseudo-element.
- **Depth/contact shadow:** use a soft ambient shadow plus a smaller, darker contact shadow close to the lower edge. Shadows should be plausible on the current dark/light surface and must not create muddy halos.
- **Edge definition:** give controls enough edge separation to remain legible against cards and panels. Avoid a thick bright outline in the resting state.
- **Typography and iconography:** retain the existing font and icon family. Centre icons optically, align labels consistently, and avoid changing button dimensions when labels or loading states change.
- **Radius:** follow the application's existing radius language. Use the specifically requested pill shape for “My Spotify playlist”; do not make every other control a pill unless the existing design calls for it.

The finish should be closer to a premium hardware control or a well-made physical interface than a glossy arcade button. Use depth selectively: more obvious on important actions, quieter on secondary actions, and almost flat on tertiary/ghost controls.

### Required button families

Create or refine shared styling for the following families, mapping them to the actual controls found in the repository:

1. **Primary action:** the strongest visual prominence, using the existing warm accent/primary token. A visible top highlight and grounded lower shadow should make it feel raised. Reserve for the most important action in a given region (for example, create/start/submit/confirm where those actions already exist).
2. **Secondary action:** quieter contrast and less elevation, but still a definite surface with a clear edge. Use for alternatives such as pause/resume or other non-primary actions where appropriate.
3. **Tertiary / ghost action:** low visual weight, minimal or no apparent elevation at rest. Still needs a clear hover, focus and pressed response. Do not put every text action inside a heavy 3D box.
4. **Icon-only action:** consistent square/circular hit area, optical centring and accessible name. The icon must remain legible at small sizes. Preserve the button's layout footprint in loading/disabled states.
5. **Destructive action:** unmistakably destructive through the existing danger token, but not visually louder than the primary action by default. Keep destructive controls distinct from routine actions and preserve existing confirmation flows.
6. **Toggle / segmented / selection control:** visibly distinguish selected, unselected, disabled and focus states. A selected state should feel intentionally engaged or seated, not just recoloured. Do not confuse a selected genre with a button currently being pressed.
7. **Event/genre chip or bar control:** if the existing UI makes these interactive, distinguish interactive chips from read-only status indicators. Retain the existing Salsa/Bachata/other-style colour mapping and semantics.

Do not blindly apply the same shadow recipe to every family. Use a small set of reusable tokens/variants, not one-off styling on dozens of individual elements.

## 4. Interaction states and physical response

Implement and verify these states consistently across every relevant button family:

- **Resting:** clear raised/recessed hierarchy, crisp label and stable geometry.
- **Hover (fine pointer only):** a subtle lift (typically around 1px), slightly stronger highlight or shadow, and a short transition. No large scale effect. Do not rely on hover to reveal the control's purpose.
- **Pressed/active:** the surface should visibly compress into its base. Reduce the lower shadow, strengthen the inset/contact shading and move the control down by a small amount (typically 1–2px). Avoid a scale animation that makes adjacent elements jump.
- **Keyboard focus:** use a high-visibility `:focus-visible` treatment with sufficient separation from the button edge and background. Never remove the browser outline without replacing it with a proper focus indicator.
- **Disabled:** clearly unavailable without becoming unreadable. No hover lift, pointer affordance or misleading active styling. Disabled must not be communicated by opacity alone if that makes text fail contrast.
- **Loading/pending:** show the existing loading affordance where present; prevent accidental repeated activation through existing behaviour; preserve width/height so text and nearby controls do not jump. Do not invent asynchronous state handling.
- **Selected/on:** show a stable engaged state distinct from momentary active/pressed state.
- **Reduced motion:** respect `prefers-reduced-motion`; transitions must be minimal or disabled where requested.

Use CSS transitions for colour, shadow and a tiny positional change, normally in the region of **120–200ms** with a restrained easing curve. No spring physics library is needed. Disable hover-only visual effects on coarse pointers and ensure tap feedback remains clear on touchscreens.

### Interaction and accessibility requirements

- Maintain at least **44 × 44 CSS px** touch targets for interactive controls, as called for by the product specification. If an icon appears visually smaller, its clickable hit area must still meet the target.
- Use actual semantic `<button>` elements for actions wherever appropriate; preserve link semantics for navigation. Do not convert links to buttons or buttons to generic clickable `<div>` elements.
- Preserve keyboard operation, tab order, Enter/Space activation, visible focus and screen-reader names. Icon-only buttons need accessible labels; decorative icons must be hidden from assistive technology.
- Maintain WCAG 2.2 AA contrast for text and control boundaries/states. Do not rely on colour alone for genre, selected, disabled, danger or status meaning.
- Keep sufficient spacing between adjacent controls, especially destructive actions and frequently tapped admin controls.
- Check colour and depth in both existing theme modes, including any high-contrast/light mode. Do not regress the dark-room and bright-room readability requirements.

## 5. Organiser active-event layout: one-line next-up and queue fills the rest

A user reported that the organiser's queue-management view feels cramped: the visible queue of songs occupies less than half the available vertical height. The currently playing song's controls and embedded Spotify player already show its title and details, so repeating those details elsewhere wastes space.

Inspect the actual organiser active-event screen and reproduce the issue with realistic queue data before changing it. Then make the following targeted layout changes:

1. **Remove redundant currently-playing metadata.** Treat the embedded Spotify player/current-track control as the source of truth for the currently playing song's title, artist and artwork where it already displays them. Remove duplicate presentation of those same details elsewhere in the organiser view. Retain only information the embed does not provide and which the organiser genuinely needs, such as playback status, an actionable warning or a control.
2. **Reduce the next-up area to one single line.** Immediately below/alongside the current-playing controls, show only the upcoming song's identity/details and its genre colour code in one compact horizontal line. At minimum show the upcoming track title, artist (if available) and the existing genre indicator/label. Do not turn this into another large card with repeated artwork, duration, requester details or multiple metadata rows. Keep it on one line at desktop widths; at narrow widths use truncation and flexible layout rather than allowing metadata to wrap into a tall block. The genre indicator must remain visible and understandable even when the title is long.
3. **Do not show the same next-up track twice.** Inspect whether the one-line next-up summary duplicates the first row of the queue. Reuse/visually extract the first queue entry or otherwise avoid an unnecessary second full rendering of the same title and artist. Do not remove the track from the logical queue or change its ordering/reservation semantics.
4. **Give the queue the entire remaining usable vertical space.** After the player/current controls, compact next-up line and any essential organiser controls, the upcoming queue should expand to fill the rest of the available screen height. It should no longer be constrained to a short panel or less than half the viewport. Use the available viewport/container space responsively; do not hard-code a fragile fixed pixel height. Typical implementation may involve a flex/grid column with the queue region set to `flex: 1`, `min-height: 0` and independent vertical scrolling, but follow the existing layout architecture.
5. **Make the queue independently scrollable.** Keep the player, next-up line and essential admin actions visible while a long queue scrolls within its own region. Account for browser chrome, safe-area insets and standalone PWA layout on mobile. On small screens use the full remaining viewport height rather than desktop ratios; ensure the final queue items remain reachable and controls are not obscured.
6. Preserve pause, resume, skip, remove/moderate, handover, player transfer, event-end and extension controls and their current semantics. Do not move critical actions into hidden menus merely to save space.
7. Ensure the queue remains readable with 20–40 attendees and a realistic mix of genre labels, long song titles, missing metadata and warning/overflow states. Truncate gracefully; do not allow long metadata to push action buttons off-screen. Keep the existing genre colours and status meanings.

Do not change queue scheduling, ordering, fairness, reservation or playback behaviour as part of this layout change.

## 6. Attendee song search and result-list UX

The attendee song search / paste-link flow needs to be comfortable for ordinary text entry on iPhone and visually easier to scan.

### Search input and iPhone keyboard

1. Inspect the actual input attributes and any custom keyboard/input handling. The problem reported is that on iPhone the user has to switch to the number keyboard to get a spacebar while entering a song search.
2. Configure the search field for normal text entry: use an appropriate text input type and `inputmode="text"` (or omit `inputmode` if the native default is correct). Do not force `inputmode="numeric"`, `decimal`, `tel` or a URL-only keyboard for a field where users enter song titles and artist names as well as paste links. A suitable `enterkeyhint="search"` may be used if it fits the existing form behaviour.
3. Preserve the ability to paste Spotify links and type ordinary song titles. Do not strip spaces or alter the input value in a way that makes normal queries impossible. Keep existing submit/search behaviour and validation intact.
4. Verify on iOS Safari or an iPhone simulator/device where tooling is available. If a real iPhone is unavailable, verify the rendered input attributes and document that physical-device validation remains outstanding. Do not claim that a keyboard has been visually tested if it has not.

### Song search result rows

1. **Left-align the listed songs.** Song titles, artist names and any result metadata should begin from a consistent left edge. Do not centre the text within each result row.
2. **Add miniature album artwork where available.** If the existing search response or current provider integration already supplies an artwork URL, display a small square thumbnail (roughly 36–44px, adjusted to the existing row density) at the left of the result. Use `object-fit: cover`, sensible loading behaviour and a neutral placeholder when no artwork exists. Do not add a new provider, API call or image-scraping mechanism solely to obtain artwork. Artwork is an enhancement, not a dependency for selecting a song.
3. **Differentiate title and artist.** Give the song title the stronger title treatment (the existing warm/orange accent is a suitable option if it works with the palette) and the artist a distinct, readable neutral/light colour such as white or the existing secondary text token. Make the hierarchy obvious without relying on colour alone; retain legible text contrast.
4. Keep rows compact and scannable, with consistent alignment across results with and without artwork. Preserve enough space for long titles, multiple artists and narrow screens. Use sensible truncation and do not cause the action affordance to become difficult to tap.
5. Preserve the existing result-selection action, duplicate handling, metadata matching and song-submission behaviour. The artwork and typography changes must not affect which result is selected.

## 7. Spotify playlist control and add-state feedback

The “My Spotify playlist” control currently does not look sufficiently like a button. More importantly, after a user adds a playlist, the interface does not clearly confirm success or prevent accidental re-addition in the playlist list.

### “My Spotify playlist” control

- Restyle **“My Spotify playlist”** as an unmistakable **pillbox button**: fully rounded ends, clear surface/background, visible edge, restrained 3D elevation, tactile hover/pressed response and a sufficiently large touch target.
- Keep its styling consistent with the shared button system and the existing Qroove palette. Do not automatically apply Spotify green to the whole control unless that is already part of the product's visual language; keep the label legible and the action hierarchy clear.
- Preserve its exact current action and semantic element. If it is a navigation link, retain link semantics and its destination; style it as a button without replacing it with a non-functional element.

### Successful playlist addition

1. Inspect the existing playlist-add flow and identify the authoritative point at which an addition has actually succeeded. Do not show a persistent success state merely because the user tapped the control if the request can still fail. If the existing UI uses optimistic updates, ensure a failed request rolls the UI state back and communicates failure.
2. Immediately after a confirmed successful add, provide clear visual confirmation. Use a success treatment consistent with the palette (for example, a green check / “Added” state or compact success notice), so the user can tell at a glance that the playlist was added. Do not rely on a subtle colour tint alone.
3. **Automatically collapse the playlist list/picker immediately after a successful add.** The user should return to a compact collapsed state where the success confirmation is visible, rather than being left looking at the expanded list with no indication that anything happened. Do not collapse on failure or before success is confirmed.
4. When the user reopens the playlist list, any playlist that this same user has already successfully added to the current event should appear **at the top** of the list, clearly marked as already added, with a green success highlight/status indicator and a visually muted/greyed-out disabled presentation.
5. An already-added playlist must not be clickable or addable again accidentally. It must have no active hover/pressed treatment, must not trigger navigation/addition on click/tap, and must be exposed accessibly as a non-available/already-added item (for example, a genuinely disabled control where the existing element is a button, or a non-interactive status row). Retain visible text such as **“Added”** so the meaning does not rely on colour alone.
6. The visual balance must satisfy both parts of the request: the row should be recognisably successful through a green edge/check/badge, while the main row content is muted/greyed and clearly disabled. Do not make it look like a fresh, actionable green primary button.
7. Keep unadded playlists in their existing relative order beneath the already-added entry/entries. Do not arbitrarily reorder or remove other playlists.
8. Use a stable playlist identity (provider playlist ID or the existing canonical identifier), not playlist title text alone, to identify an already-added playlist. Scope the status to the current participant and current event, following the app's existing product semantics; do not mark a playlist as added just because a different attendee added the same playlist unless the existing implementation explicitly defines the state as event-global.
9. Reuse the existing server response, event request state, participant identity and persistence mechanism wherever possible. The “already added” state should survive collapsing/reopening and normal navigation within the event. Do not invent a new backend contract or database field in this task. If the existing data cannot reliably support the status after a refresh or revisit, document exactly what is missing and the smallest required follow-up rather than pretending a transient front-end flag is durable.
10. Prevent accidental double submission while an add request is pending using the existing loading/disabled mechanism. Preserve current error handling and retry behaviour.

Do not change Spotify authentication, playlist discovery, import limits, track deduplication, submission quotas or server-side playlist semantics.

## 8. Event / genre bar and breakpoint marker

The event/genre bar may receive a small polish pass, but the existing genre mapping and semantics are authoritative. The breakpoint marker change below is required, not optional.

### Required breakpoint marker change

- Locate the **vertical breakpoint bar/marker** associated with the purple event-bar box. Confirm from the code and functional documentation what it represents; do not change its timing, value, calculation or meaning.
- Move/render it **inside the purple box, inset against the right-hand side** rather than outside or visually detached from the box.
- Make it **bright yellow** so it creates a sharp, immediate contrast against the purple background. Use a sufficiently vivid yellow and a crisp vertical line/bar rather than a soft glow. It should be clearly visible at a glance, including on mobile and in the installed PWA.
- Keep it aligned to the full usable height of the purple box (or the intended marker height established by the existing design), with a small consistent inset from the right edge. It must not overlap or obscure genre labels, counts or other event-bar information.
- Preserve the purple box and all existing genre/style colours. Do not repurpose a genre colour for the breakpoint marker or change any genre-to-colour mapping.
- Preserve the marker's actual data/state and accessibility semantics. Where needed, provide a textual or accessible label so its meaning is not communicated by yellow alone.

### Optional event/genre bar polish

After the required marker fix, inspect whether the rest of the bar needs refinement:

- Improve separation and legibility between style segments, labels and counts/caps if these already exist.
- Give the active/current genre indicator a clear but restrained treatment (for example, a subtle inset/raised state, fine outline or small highlight). Avoid making every genre glow.
- Ensure text/icon labels remain readable and users can understand the status without relying on colour alone.
- Do not rework event setup, event status, genre caps, transitions, allowed styles or scheduler behaviour.

If the rest of the event bar already reads clearly, leave it alone and report that the optional polish was not justified. The bright-yellow breakpoint marker change must still be completed.

## 9. Implementation approach

1. Identify shared button components, base styles, theme variables and the specific attendee/organiser components named above. Consolidate duplicated button styling only where this is low-risk and consistent with the codebase. Prefer a small, maintainable variant system over per-page overrides.
2. Define a compact set of CSS custom properties or existing design tokens for surface gradients, highlight, border, ambient shadow, contact shadow, pressed inset, focus ring and transition timing. Reuse the existing theme palette; derive tonal steps from existing variables where possible.
3. Implement button family variants in the existing component/style architecture. Give “My Spotify playlist” its specific pill radius without changing the shape language of unrelated controls.
4. Fix the search input using native input attributes and existing form behaviour. Do not implement an unnecessary custom keyboard.
5. Update search result rows using existing artwork/metadata fields only. Keep the result's click/selection target and keyboard behaviour unchanged.
6. Implement playlist success/collapse/already-added presentation using the existing state and identity model. Use stable IDs and existing authoritative success data. Do not add a new endpoint, provider integration, database field or schema migration. If this cannot be achieved reliably with current data, stop short of a misleading workaround and record the exact blocker and follow-up.
7. Apply the organiser layout change using the current component structure and responsive rules. Prefer layout primitives such as flex/grid and independent scrolling over brittle fixed heights. Keep the next-up metadata to one line and avoid rendering it twice.
8. Move/style the breakpoint marker inside the purple event-bar box, on its right side, in bright yellow. Keep its underlying data and semantics unchanged.
9. Preserve component APIs and existing event handlers. Do not rename props, change action callbacks, alter routing or affect form submission behaviour merely to style controls.
10. Keep CSS efficient and mobile-first. Avoid expensive blur/filter effects across large surfaces; do not add continuous animation or cause layout reflow on interaction. Use pseudo-elements sparingly and account for `overflow`, stacking contexts and z-index.
11. Keep the diff focused. Do not reformat unrelated files or rename unrelated components. Do not update dependencies unless an existing dependency is demonstrably necessary (it should not be for this task).

## 10. Visual QA and regression checks

After implementation, run the app locally and inspect before/after views at minimum at **1440 × 900** and **390 × 844**. Also inspect at a narrow width around **320–360px** and one tablet-sized width where supported. Use representative content and all meaningful button variants.

### Required visual and interaction scenarios

- **Buttons:** primary, secondary, ghost, icon-only, destructive, toggle/segmented, selected, hover, pressed, focus, disabled and loading/pending states.
- **Attendee search:** enter a multi-word song title with spaces; paste a Spotify link; select a result; test long titles and multiple artists; inspect rows with artwork and without artwork.
- **iPhone input:** verify the normal text keyboard and spacebar on iOS Safari/device or simulator when available. If unavailable, inspect the exact input attributes and mark real-device confirmation as outstanding.
- **Playlist flow:** open “My Spotify playlist”; open playlist list; add a playlist; confirm success is visible; confirm the list collapses immediately; reopen it; confirm the added playlist appears first, has a green success indicator, looks muted/greyed out, and cannot be clicked or added again; confirm remaining playlists remain usable and in their previous relative order. Test pending, failed and retry states.
- **Organiser:** inspect current-playing Spotify embed; verify duplicate current-track title/artist/artwork has been removed elsewhere; verify next-up is a single line with title, artist and genre code; verify the same next-up track is not unnecessarily duplicated; verify the queue occupies all remaining usable vertical height and scrolls independently.
- **Queue content:** realistic long queue, 20–40 attendee load, long titles, missing metadata, unavailable duration, warnings and overflow rows; make sure actions remain reachable.
- **Event bar:** verify the breakpoint marker is inside the right edge of the purple box, bright yellow, sharp and visible; verify existing genre colours and labels are unchanged.
- **Admin controls:** create/start actions where present; pause/resume; skip; remove/moderation and confirmation; extend-until control; admin handover; player transfer; end event; disabled/loading/waiting states.
- **Accessibility and responsive behaviour:** keyboard-only navigation and visible focus; touch interaction without hover; 44px hit areas; reduced-motion setting; contrast; existing theme modes; mobile browser and standalone PWA safe areas.

Run the repository's existing lint, type-check, unit/integration tests and production build as appropriate. Add or update focused component tests only if the project already has a suitable test setup. Confirm that visual changes have not changed click behaviour, form submission, disabled logic, navigation, playlist add semantics, admin permission boundaries or queue/playback rules.

Do not claim visual QA has passed if you only inspected the source. If browser automation or screenshot capture is unavailable, state which checks were performed and which remain manual.

## 11. Acceptance criteria

The task is complete only when all of the following are true:

- Existing button types share a coherent tactile material language, with clear and consistent raised, hover, pressed, focused, disabled, loading and selected states where relevant.
- The 3D depth is visible enough to improve affordance but restrained enough to retain the product's clean, dark, warm visual identity. There are no cartoonish highlights, muddy halos or oversized shadows.
- Primary, secondary, ghost, icon-only, destructive and toggle controls have distinct hierarchy and are not visually interchangeable.
- “My Spotify playlist” is clearly recognisable as a pillbox button/control and retains its original action.
- The song search input accepts normal multi-word text on iPhone without requiring a switch to the numeric keyboard; pasted links still work.
- Song search results are left-aligned; song title and artist have a clear visual hierarchy; miniature artwork is shown when already available and missing artwork is handled gracefully.
- A successful playlist addition is visibly confirmed and the playlist list collapses immediately afterwards.
- On reopening the list, the current user's already-added playlist(s) appear at the top, show a green “Added” confirmation, are visually muted/greyed out and cannot be clicked or added again. The state is based on a stable playlist identity and the existing state source; any limitation in persistence is explicitly reported rather than concealed.
- The organiser's currently playing details are not duplicated outside the embedded player where those details are already shown.
- The upcoming-song summary is one compact line containing the next track's identity/details and genre colour code, with no unnecessary duplicate rendering of that track.
- The upcoming queue expands to occupy the full remaining usable vertical space, scrolls independently and remains usable on mobile/tablet/desktop.
- The breakpoint marker is inside the right-hand side of the purple event-bar box, bright yellow and sharply contrasted; the marker's meaning and all genre colour mappings remain unchanged.
- Touch targets meet the 44 × 44 CSS px target; keyboard focus, semantic controls, reduced-motion and contrast requirements remain satisfied.
- Core functionality and permissions are unchanged: no queue logic, event rules, playback semantics, API contracts, data schema, authentication, authorisation or PWA behaviour has been altered.
- Relevant checks and build pass, or every failure and its relationship to this work is clearly reported.
- The final diff is tightly scoped and contains no unrelated refactors.

## 12. Required final response: precise execution checklist

When finished, provide a concise but precise implementation report with these sections:

### A. What changed
A checklist of each completed action, grouped into:
- Shared button system and 3D visual tokens.
- “My Spotify playlist” pillbox control.
- iPhone song-search input and keyboard behaviour.
- Song-search result alignment, typography and artwork.
- Playlist success feedback, auto-collapse and already-added state.
- Organiser next-up line and queue vertical-space/scrolling correction.
- Event-bar breakpoint marker and any optional genre-bar polish.

For every checklist item, name the relevant file/component and describe the actual change. Avoid vague entries such as “improved styling”. Distinguish completed items from anything blocked by existing data/API limitations.

### B. Before → after
Describe the most important visible improvements in concrete terms: button surface depth/light/shadow and pressed response; pillbox playlist control; iPhone text-entry behaviour; song-result alignment/artwork/typography; clear playlist-added feedback; organiser queue vertical allocation and one-line next-up summary; bright-yellow breakpoint marker. Include screenshot paths or attach/cite before/after captures if your tooling supports them.

### C. Validation
List the exact commands run and their outcomes (lint, type-check, tests, build), viewport sizes inspected, and interaction scenarios checked. Separate automated test results from visual/manual review. Explicitly state whether a physical iPhone/iOS simulator was used.

### D. Scope confirmation
Explicitly confirm that queue logic, event rules, playback, API/data contracts, schema, admin permissions, authentication and PWA behaviour were not changed. State any necessary front-end state changes for playlist feedback. List any unavoidable scope exception.

### E. Remaining to-do list
Provide only actionable remaining items, each with priority (**P0/P1/P2**), file/component or screen, and a concrete next action. Include any playlist-state persistence blocker or real-iPhone validation still outstanding. If nothing remains, say so. Do not pad this list with speculative redesign ideas.

---

## Final instruction

Make the changes now. Exercise judgement and proceed without asking for clarification where the existing code and documentation provide a safe answer. If a detail is genuinely ambiguous, preserve the existing behaviour and choose the least invasive visual solution. Implement every explicitly requested item that can be completed safely within the scope above; do not silently omit the meeting feedback. The goal is a noticeably more premium, tactile and usable Qroove interface achieved through a focused visual/UX rejig—not a new product design.
