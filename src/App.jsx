import React, { useState, useEffect } from 'react'
import CustomerMenu from '../components/CustomerMenu'
import AdminDashboard from '../components/AdminDashboard'
import CustomerDashboard from '../components/CustomerDashboard'

function App() {
    const [view, setView] = useState('landing'); // 'landing' | 'menu' | 'dashboard'
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // Very basic routing based on URL path
        if (window.location.pathname === '/admin') {
            setIsAdmin(true);
        }
    }, []);

    if (isAdmin) {
        return <AdminDashboard />;
    }

    return (
        <div className="landing-wrapper">
            {/* Minimal Premium Header */}
            <header className="brand-header">
                <div className="brand-logo">Ko Chef Dips</div>
                <div className="brand-tagline">Premium Kota Experience</div>
            </header>

            {view === 'landing' && (
                <div className="landing-page-scroll">
                    {/* Hero Section */}
                    <main className="hero-section" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div className="hero-content">
                            <span style={{ color: '#00e676', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                "Dumelang chommi tsaka"
                            </span>
                            <h1 className="hero-title">Nothing brings people together like <br /><span>good quality food.</span></h1>
                            <p className="hero-subtitle">Eskort Or Nothing. Kel Rata Zwap.</p>

                            <div className="feature-badges" style={{ marginTop: '2rem' }}>
                                <span className="badge">📍 Seshego Zone 4</span>
                                <span className="badge">📍 Lebowakgomo</span>
                                <span className="badge">🚐 Events Mobile Stall</span>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '3rem', flexWrap: 'wrap' }}>
                                <button
                                    className="btn-primary hero-btn"
                                    onClick={() => setView('menu')}
                                    style={{ flex: '1 1 250px', maxWidth: '300px', padding: '1.25rem' }}
                                >
                                    Start Online Order
                                </button>
                                <button
                                    className="btn-secondary hero-btn"
                                    onClick={() => setView('dashboard')}
                                    style={{ flex: '1 1 250px', maxWidth: '300px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    Track My Order
                                </button>
                            </div>
                        </div>
                    </main>

                    {/* About Section */}
                    <section style={{ padding: '6rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', color: '#f8fafc' }}>About Chef Dips</h2>
                            <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: '1.8', marginBottom: '2rem' }}>
                                Welcome to Ko Chef Dips! What started as a passion for feeding people has grown into the ultimate Kota experience. We believe in massive portions, premium ingredients, and that unmistakable South African flavor. Whether you're pulling up to our permanent stores or catching our mobile stall at an event, you're guaranteed a meal made with love.
                            </p>
                            <div style={{ width: '60px', height: '4px', background: '#00e676', margin: '0 auto', borderRadius: '2px' }}></div>
                        </div>
                    </section>

                    {/* Gallery Section */}
                    <section style={{ padding: '6rem 2rem', background: '#1e293b' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', color: '#f8fafc', textAlign: 'center' }}>The Masterpieces</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {/* High Quality local generated images */}
                                <div style={{ height: '300px', background: 'url(/images/kota_1.png) center/cover', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}></div>
                                <div style={{ height: '300px', background: 'url(/images/kota_2.png) center/cover', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}></div>
                                <div style={{ height: '300px', background: 'url(/images/kota_3.png) center/cover', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}></div>
                            </div>
                            <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem', fontStyle: 'italic' }}>* Premium South African Kota craftsmanship.</p>
                        </div>
                    </section>

                    {/* Contact & Locations */}
                    <section style={{ padding: '6rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.5rem', color: '#f8fafc', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Visit Us</h3>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: '#00e676', margin: '0 0 0.5rem 0' }}>📍 Seshego Branch</h4>
                                    <p style={{ color: '#94a3b8', margin: 0 }}>Zone 4, Opposite the complex.</p>
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: '#00e676', margin: '0 0 0.5rem 0' }}>📍 Lebowakgomo Branch</h4>
                                    <p style={{ color: '#94a3b8', margin: 0 }}>Check our WhatsApp status for the spot.</p>
                                </div>
                                <div>
                                    <h4 style={{ color: '#00e676', margin: '0 0 0.5rem 0' }}>🚐 Mobile Stall</h4>
                                    <p style={{ color: '#94a3b8', margin: 0 }}>Available for bookings & local events.</p>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ fontSize: '1.5rem', color: '#f8fafc', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Get in Touch</h3>
                                <p style={{ color: '#94a3b8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '1.5rem' }}>📱</span>
                                    <a href="tel:0691159832" style={{ color: '#f8fafc', textDecoration: 'none', fontSize: '1.1rem' }}>069 115 9832</a>
                                </p>
                                <p style={{ color: '#94a3b8', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '1.5rem' }}>✉️</span>
                                    <a href="mailto:kochefdips@gmail.com" style={{ color: '#f8fafc', textDecoration: 'none', fontSize: '1.1rem' }}>kochefdips@gmail.com</a>
                                </p>

                                <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid #334155' }}>
                                    <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
                                        "Follow us on Facebook to see where the Mobile Stall is dropping next!"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <footer style={{ background: '#020617', padding: '2rem', textAlign: 'center', color: '#475569', borderTop: '1px solid #1e293b' }}>
                        <p>&copy; {new Date().getFullYear()} Ko Chef Dips. All rights reserved. Powered by Kota Guard.</p>
                    </footer>
                </div>
            )}

            {view === 'menu' && (
                <div className="order-flow-wrapper">
                    <CustomerMenu />
                </div>
            )}

            {view === 'dashboard' && (
                <div className="order-flow-wrapper">
                    <CustomerDashboard onBack={() => setView('landing')} />
                </div>
            )}
        </div>
    )
}

export default App
