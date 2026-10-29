import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { EventPage } from './attendee/EventPage';
import { Landing } from './landing/Landing';
import { Privacy } from './landing/Privacy';
import { Layout } from './shared/Layout';

const Create = lazy(() => import('./landing/Create'));

export function AppRoutes() {
  return (
    <Layout>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/e/:slug" element={<EventPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/create" element={<Create />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
