import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { EventPage } from './attendee/EventPage';
import { Landing } from './landing/Landing';
import { Privacy } from './landing/Privacy';
import { Layout } from './shared/Layout';

const CreateEvent = lazy(() => import('./admin/CreateEvent'));
const AdminEntry = lazy(() => import('./admin/AdminEntry'));
const AdminPage = lazy(() => import('./admin/AdminPage'));
const ImportEvent = lazy(() => import('./admin/ImportEvent'));
const Historical = lazy(() => import('./admin/Historical'));
const PlayerPage = lazy(() => import('./player/PlayerPage'));

export function AppRoutes() {
  return (
    <Layout>
      <Suspense fallback={<p role="status">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/e/:slug" element={<EventPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/new" element={<CreateEvent />} />
          <Route path="/import" element={<ImportEvent />} />
          <Route path="/a/:eventId" element={<AdminEntry mode="link" />} />
          <Route path="/claim/:eventId" element={<AdminEntry mode="claim" />} />
          <Route path="/admin/:eventId" element={<AdminPage />} />
          <Route path="/h/:slug" element={<Historical />} />
          <Route path="/player/:eventId" element={<PlayerPage />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
