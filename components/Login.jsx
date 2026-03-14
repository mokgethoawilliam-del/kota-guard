import React, { useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authErr } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authErr) throw authErr;
            navigate('/admin');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '20px'
        }}>
            <div className="login-card" style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '3rem',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '450px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: '800', 
                        color: '#00e676', 
                        marginBottom: '0.5rem',
                        letterSpacing: '-1px'
                    }}>
                        Kota Guard
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Vendor Dashboard Login</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        fontSize: '0.95rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email Address</label>
                        <input
                            type="email"
                            required
                            className="kds-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="chef@kotaguard.com"
                            style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Password</label>
                        <input
                            type="password"
                            required
                            className="kds-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{ width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            borderRadius: '12px',
                            transition: 'all 0.2s',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                    </button>
                </form>

                <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Enter your vendor credentials to manage your store, orders, and inventory.
                    </p>
                </div>
            </div>
        </div>
    );
}
