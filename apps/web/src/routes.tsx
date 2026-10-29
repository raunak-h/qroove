import { Route, Routes } from 'react-router';
import { Landing } from './landing/Landing';
import { Layout } from './shared/Layout';

export function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Layout>
  );
}
