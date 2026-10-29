import { Link } from 'react-router';

/** Placeholder until the organiser UI ships (Phase 6). */
export default function Create() {
  return (
    <section className="card">
      <h1>Create an event</h1>
      <p>
        Organiser tools are coming in the next release. Until then, events can be created through
        the API.
      </p>
      <Link to="/">Back</Link>
    </section>
  );
}
