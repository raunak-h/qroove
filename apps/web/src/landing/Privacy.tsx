import { BRAND } from '@qroove/config';

export function Privacy() {
  return (
    <article className="stack">
      <h1>Privacy</h1>
      <p>Qroove needs no account. In short:</p>
      <ul>
        <li>
          This device gets a random pass for each event you join. It is stored in your browser only.
        </li>
        <li>
          We store the songs you add and the name you join with, which shows the organiser who added
          each song.
        </li>
        <li>Participant records are deleted 30 days after an event ends.</li>
        <li>No audio is stored or streamed by Qroove. There are no ads or trackers.</li>
        <li>
          Searching sends your search words to Spotify. Pasting a link sends only the song id to the
          music service it came from to read its title.
        </li>
      </ul>
      <p>
        The full details are in the{' '}
        <a href={`${BRAND.docsPath}/privacy`}>privacy page in the docs</a>.
      </p>
    </article>
  );
}
