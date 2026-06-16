import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { ProfessorProfile } from '@/pages/ProfessorProfile';
import { HistoricalData } from '@/pages/HistoricalData';
import { RoleDashboard } from '@/pages/RoleDashboard';
import { LiveDataPage } from '@/pages/LiveData';
import { CoordinatorManagement } from '@/pages/CoordinatorManagement';
import { UnifiedAnalysisCenter } from '@/pages/UnifiedAnalysisCenter';
import { AIInsightsPage } from '@/pages/AIInsights';

const Login = lazy(() => import('@/pages/Login').then((module) => ({ default: module.Login })));
const RegisterSelect = lazy(() => import('@/pages/Register').then((module) => ({ default: module.RegisterSelect })));
const ProfessorRegister = lazy(() => import('@/pages/Register/ProfessorRegister').then((module) => ({ default: module.ProfessorRegister })));
const CoordinatorRegister = lazy(() => import('@/pages/Register/CoordinatorRegister').then((module) => ({ default: module.CoordinatorRegister })));

function AuthFallback() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
            <div className="flex items-center gap-3 rounded-[24px] border border-border-subtle bg-white/90 px-5 py-4 text-sm font-medium text-text-secondary shadow-card">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
                Carregando...
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route
                        path="/login"
                        element={(
                            <Suspense fallback={<AuthFallback />}>
                                <Login />
                            </Suspense>
                        )}
                    />
                    <Route
                        path="/register"
                        element={(
                            <Suspense fallback={<AuthFallback />}>
                                <RegisterSelect />
                            </Suspense>
                        )}
                    />
                    <Route
                        path="/register/professor"
                        element={(
                            <Suspense fallback={<AuthFallback />}>
                                <ProfessorRegister />
                            </Suspense>
                        )}
                    />
                    <Route
                        path="/register/coordinator"
                        element={(
                            <Suspense fallback={<AuthFallback />}>
                                <CoordinatorRegister />
                            </Suspense>
                        )}
                    />

                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />

                        <Route path="professor/dashboard" element={<RoleDashboard />} />
                        <Route path="professor/live-data" element={<LiveDataPage />} />
                        <Route path="professor/profile" element={<ProfessorProfile />} />
                        <Route path="professor/historical-upload" element={<HistoricalData defaultTab="upload" />} />
                        <Route path="professor/historical-data" element={<HistoricalData defaultTab="history" />} />
                        <Route path="professor/analysis-center" element={<UnifiedAnalysisCenter />} />
                        <Route path="professor/ai-insights" element={<AIInsightsPage />} />

                        <Route path="proreitor/dashboard" element={<RoleDashboard />} />
                        <Route path="proreitor/live-data" element={<LiveDataPage />} />
                        <Route path="proreitor/profile" element={<ProfessorProfile />} />
                        <Route path="proreitor/historical-upload" element={<HistoricalData defaultTab="upload" />} />
                        <Route path="proreitor/historical-data" element={<HistoricalData defaultTab="history" />} />
                        <Route path="proreitor/analysis-center" element={<UnifiedAnalysisCenter />} />
                        <Route path="proreitor/ai-insights" element={<AIInsightsPage />} />
                        <Route path="proreitor/coordinators" element={<CoordinatorManagement />} />

                        <Route path="coordinator/dashboard" element={<RoleDashboard />} />
                        <Route path="coordinator/live-data" element={<LiveDataPage />} />
                        <Route path="coordinator/profile" element={<ProfessorProfile />} />
                        <Route path="coordinator/historical-upload" element={<HistoricalData defaultTab="upload" />} />
                        <Route path="coordinator/historical-data" element={<HistoricalData defaultTab="history" />} />
                        <Route path="coordinator/analysis-center" element={<UnifiedAnalysisCenter />} />
                        <Route path="coordinator/ai-insights" element={<AIInsightsPage />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
