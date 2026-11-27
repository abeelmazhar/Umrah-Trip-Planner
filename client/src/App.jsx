import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

// Heavier pages are loaded on demand, so the first visit downloads less JavaScript.
const NewTrip = lazy(() => import('./pages/NewTrip'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const SharedTrip = lazy(() => import('./pages/SharedTrip'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const JoinGroup = lazy(() => import('./pages/JoinGroup'));
const LostCard = lazy(() => import('./pages/LostCard'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const Assistant = lazy(() => import('./pages/Assistant'));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/share/:token" element={<SharedTrip />} />
          <Route path="/lost/:token" element={<LostCard />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trips/new" element={<NewTrip />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
            <Route path="/join/:code" element={<JoinGroup />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/assistant" element={<Assistant />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
