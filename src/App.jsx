import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import VendorLandingPage from '../components/VendorLandingPage'
import AdminDashboard from '../components/AdminDashboard_modern'
import Login from '../components/Login'
import RegisterShop from '../components/RegisterShop'
import PlatformHome from '../components/PlatformHome'
import LegalTerms from '../components/LegalTerms'

function AuthGuard({ children, session }) {
    if (!session) return <Navigate to="/login" replace />;
    return children;
}

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) return <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading VulaHub...</div>;

    return (
        <Router>
            <Routes>
                {/* Auth Routes */}
                <Route path="/login" element={session ? <Navigate to="/admin" replace /> : <Login />} />
                <Route path="/register" element={session ? <Navigate to="/admin" replace /> : <RegisterShop />} />

                {/* Admin Route - Protected By AuthGuard */}
                <Route path="/admin" element={
                    <AuthGuard session={session}>
                        <AdminDashboard session={session} />
                    </AuthGuard>
                } />

                {/* Dynamic Vendor Route */}
                <Route path="/v/:vendorSlug" element={<VendorLandingPage />} />

                {/* VulaHub Platform Landing Page */}
                <Route path="/" element={<PlatformHome />} /> 

                {/* Legal Terms & Disclaimer */}
                <Route path="/legal" element={<LegalTerms />} /> 

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    )
}

export default App
