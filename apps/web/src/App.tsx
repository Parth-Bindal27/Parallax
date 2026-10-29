import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Layout } from './components/Layout.js';
import { MissionWorkspace } from './pages/MissionWorkspace.js';
import { LiveExecution } from './pages/LiveExecution.js';
import { EvidenceExplorer } from './pages/EvidenceExplorer.js';
import { LineageGraph } from './pages/LineageGraph.js';
import { VerificationReport } from './pages/VerificationReport.js';
import { Settings } from './pages/Settings.js';
import { api } from './api/client.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1
    }
  }
});

// Helper component for /missions/latest/live
function LatestMissionRedirect() {
  const { data } = useQuery({
    queryKey: ['missions'],
    queryFn: () => api.listMissions()
  });

  const latest = data?.missions?.[0];
  if (latest) {
    return <Navigate to={`/missions/${latest.id}/live`} replace />;
  }
  return <Navigate to="/" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<MissionWorkspace />} />
            <Route path="missions/latest/live" element={<LatestMissionRedirect />} />
            <Route path="missions/:id/live" element={<LiveExecution />} />
            <Route path="missions/:id/evidence" element={<EvidenceExplorer />} />
            <Route path="missions/:id/lineage" element={<LineageGraph />} />
            <Route path="missions/:id/report" element={<VerificationReport />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
