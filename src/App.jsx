import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import CustomerMenu from '../components/CustomerMenu'
import AdminDashboard from '../components/AdminDashboard'
import CustomerDashboard from '../components/CustomerDashboard'

function App() {
    const [view, setView] = useState('landing'); // 'landing' | 'menu' | 'dashboard'
    const [isAdmin, setIsAdmin] = useState(false);

    // CMS Data
    const [mobileStalls, setMobileStalls] = useState([]);

    // Featured Menu Data
    const [featuredMenu, setFeaturedMenu] = useState([]);

    useEffect(() => {
        // Very basic routing based on URL path
        if (window.location.pathname === '/admin') {
            setIsAdmin(true);
        }

        // Fetch Active Mobile Stalls
        const fetchStalls = async () => {
            const { data } = await supabase.from('locations').select('*').eq('is_mobile', true).eq('is_active', true);
            if (data) {
                setMobileStalls(data);
            }
        };
        fetchStalls();

        // Fetch Live Menu Items for the Gallery
        const fetchFeaturedMenu = async () => {
            const { data, error } = await supabase.from('menu_items').select('*').order('price');
            if (data) setFeaturedMenu(data);
        };
        fetchFeaturedMenu();
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
                    <main className="hero-section" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', padding: '6rem 2rem 2rem 2rem' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
                            {/* Text Content Side */}
                            <div className="hero-content" style={{ textAlign: 'left', margin: 0 }}>
                                <span style={{ color: '#00e676', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    "Dumelang chommi tsaka"
                                </span>
                                <h1 className="hero-title" style={{ fontSize: '3.5rem', lineHeight: '1.1' }}>
                                    Nothing brings people together like <span style={{ color: '#00e676' }}>good quality food.</span>
                                </h1>
                                <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', opacity: 0.9 }}>
                                    Eskort Or Nothing. Kel Rata Zwap.
                                </p>

                                <div className="feature-badges" style={{ marginTop: '2rem', justifyContent: 'flex-start' }}>
                                    <span className="badge">📍 Seshego Zone 4</span>
                                    <span className="badge">📍 Lebowakgomo</span>
                                    <span className="badge">🚐 Events Mobile Stall</span>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                                    <button
                                        className="btn-primary hero-btn"
                                        onClick={() => setView('menu')}
                                        style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem' }}
                                    >
                                        Start Online Order
                                    </button>
                                    <button
                                        className="btn-secondary hero-btn"
                                        onClick={() => setView('dashboard')}
                                        style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                        Track My Order
                                    </button>
                                </div>
                            </div>

                            {/* Image Side */}
                            <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                                <div style={{
                                    aspectRatio: '3/4',
                                    background: 'url(/images/chef_dips_hero.jpg) center/cover, #1e293b',
                                    borderRadius: '24px',
                                    boxShadow: '0 20px 40px rgba(0, 230, 118, 0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#94a3b8',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    border: '1px solid rgba(0, 230, 118, 0.3)'
                                }}>
                                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f8fafc' }}>Add Your Hero Photo Here</span>
                                    <span style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Save a photo of you carrying two Kotas as <strong>chef_dips_hero.jpg</strong> inside <strong>public/images/</strong></span>
                                </div>
                                {/* Decorative elements */}
                                <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', background: '#0f172a', padding: '1rem', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                                    <div style={{ color: '#00e676', fontWeight: 'bold' }}>⭐ 4.9/5 Rating</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>From hundreds of locals</div>
                                </div>
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
                                {featuredMenu.length > 0 ? (
                                    featuredMenu.map(item => (
                                        <div key={item.id} style={{ height: '300px', background: item.image_url ? `url(${item.image_url}) center/cover` : '#334155', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' }}>
                                            {/* Gradient overlay for text readability */}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(15,23,42,0.9), transparent)' }} />

                                            <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                <div>
                                                    <h3 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1.25rem' }}>{item.name}</h3>
                                                    <p style={{ margin: 0, color: '#00e676', fontWeight: 'bold' }}>R {item.price}</p>
                                                </div>
                                                <button onClick={() => setView('menu')} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ colSpan: 3, textAlign: 'center', color: '#64748b' }}>Menu is currently being updated...</div>
                                )}
                            </div>
                            <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem', fontStyle: 'italic' }}>* Real, authentic Kotas crafted by Chef Dips.</p>
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
                                {mobileStalls.length > 0 && (
                                    <div>
                                        <h4 style={{ color: '#00e676', margin: '0 0 0.5rem 0' }}>🚐 Upcoming Mobile Stalls</h4>
                                        <p style={{ color: '#94a3b8', margin: '0 0 1rem 0' }}>Available for bookings & local events.</p>

                                        {mobileStalls.map(stall => (
                                            <div key={stall.id} style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0, 230, 118, 0.1)', borderLeft: '3px solid #00e676', borderRadius: '0 4px 4px 0', marginBottom: '1.5rem' }}>
                                                <strong style={{ color: '#00e676', display: 'block', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{stall.name}</strong>
                                                <span style={{ color: '#f8fafc', fontStyle: 'italic', display: 'block', marginBottom: '0.5rem' }}>{stall.banner_text}</span>

                                                {stall.stall_date && (
                                                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                                        <strong>📅 Date:</strong> {stall.stall_date}
                                                    </div>
                                                )}
                                                {stall.preorder_start_date && (
                                                    <div style={{ color: '#fbbf24', fontSize: '0.9rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                                                        <strong>🔥 Pre-orders Open:</strong> {stall.preorder_start_date}
                                                    </div>
                                                )}
                                                {stall.preorder_deadline && (
                                                    <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '0.25rem', fontWeight: 'bold' }}>
                                                        <strong>⏰ Closes:</strong> {stall.preorder_deadline}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
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
