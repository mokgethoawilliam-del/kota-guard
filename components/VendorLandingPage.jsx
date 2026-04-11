import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../src/supabaseClient';
import CustomerMenu from './CustomerMenu';
import CustomerDashboard from './CustomerDashboard';

function VendorLandingPage() {
    const { vendorSlug } = useParams();
    const navigate = useNavigate();
    const [view, setView] = useState('landing'); // 'landing' | 'menu' | 'dashboard'
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allLocations, setAllLocations] = useState([]);
    const [featuredMenu, setFeaturedMenu] = useState([]);

    useEffect(() => {
        const fetchVendorData = async () => {
            try {
                setLoading(true);
                const hostname = window.location.hostname;
                let query = supabase.from('vendors').select('*');

                if (vendorSlug) {
                    query = query.eq('slug', vendorSlug);
                } else if (hostname !== 'localhost' && !hostname.endsWith('.vercel.app') && !hostname.endsWith('.vulahub.com')) {
                    query = query.eq('custom_domain', hostname);
                } else {
                    query = query.eq('slug', 'chef-dips');
                }

                const { data: vendorData, error: vErr } = await query.single();

                if (vErr || !vendorData) {
                    console.error("Vendor not found:", vErr);
                    setLoading(false);
                    return;
                }

                setVendor(vendorData);

                // Apply branding colors
                const branding = vendorData.branding || {};
                document.documentElement.style.setProperty('--color-primary', branding.primary_color || '#00e676');
                document.documentElement.style.setProperty('--color-secondary', branding.secondary_color || '#1e293b');

                // 3. Fetch ALL Active Locations (Permanent & Mobile)
                const { data: locs } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_active', true);
                setAllLocations(locs || []);

                // 4. Fetch Vendor's Menu (for Gallery)
                const { data: menu } = await supabase
                    .from('menu_items')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .order('price');
                setFeaturedMenu(menu || []);

            } catch (err) {
                console.error("Error loading vendor:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVendorData();
    }, [vendorSlug]);

    if (loading) return <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading {vendorSlug || 'VulaHub'}...</div>;
    if (!vendor) return <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vendor "{vendorSlug}" not found.</div>;

    const branding = vendor.branding || {};

    return (
        <div className="landing-wrapper" style={{ background: '#0f172a', color: '#f8fafc' }}>
            <header className="brand-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <div className="brand-logo" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{vendor.name}</div>
                   <div className="brand-tagline" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{branding.tagline || 'Premium Kota Experience'}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={() => setView('dashboard')} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Track Order</button>
                    <button className="btn-primary" onClick={() => setView('menu')} style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>Order Online</button>
                </div>
            </header>

            {view === 'landing' && (
                <div className="landing-page-scroll">
                    <main className="hero-section" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', padding: '8rem 2rem 4rem 2rem' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
                            <div className="hero-content" style={{ textAlign: 'left' }}>
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    {branding.welcome_text || '"Dumelang chommi tsaka"'}
                                </span>
                                <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '1.1', fontWeight: '800' }}>
                                    {branding.hero_title || 'Nothing brings people together like'} <span style={{ color: 'var(--primary-color)' }}>{branding.hero_highlight || 'good quality food.'}</span>
                                </h1>
                                <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', opacity: 0.9, color: '#94a3b8' }}>
                                    {branding.hero_subtitle || 'Eskort Or Nothing. Kel Rata Zwap.'}
                                </p>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                                    <button className="btn-primary hero-btn" onClick={() => setView('menu')} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', fontSize: '1.1rem' }}>
                                        Start Online Order
                                    </button>
                                    <button className="btn-secondary hero-btn" onClick={() => document.getElementById('find-us').scrollIntoView({ behavior: 'smooth' })} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
                                        Locations & Maps
                                    </button>
                                </div>
                            </div>

                            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                                <div style={{
                                    aspectRatio: '1/1',
                                    background: branding.hero_image ? `url(${branding.hero_image}) center/cover` : '#1e293b',
                                    borderRadius: '30px',
                                    boxShadow: `0 30px 60px rgba(0, 230, 118, 0.25)`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#94a3b8',
                                    border: `2px solid var(--primary-color)`,
                                    transform: 'rotate(-2deg)'
                                }}>
                                    {!branding.hero_image && (
                                        <div style={{ transform: 'rotate(2deg)' }}>
                                            <span style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block' }}>🍔</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc' }}>VulaHub Premium</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* Gallery Section */}
                    <section style={{ padding: '6rem 2rem', background: '#020617' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Our Gallery</h2>
                                <p style={{ color: '#94a3b8' }}>A taste of what we have in store for you.</p>
                                <div style={{ width: '80px', height: '4px', background: 'var(--primary-color)', margin: '1rem auto' }}></div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                                {featuredMenu.filter(m => m.image_url).map((item) => (
                                    <div key={item.id} className="gallery-item" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', background: '#1e293b' }}>
                                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
                                        <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{item.name}</h4>
                                        </div>
                                    </div>
                                ))}
                                {featuredMenu.filter(m => m.image_url).length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '2px dashed rgba(255,255,255,0.05)' }}>
                                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📸</span>
                                        <p style={{ color: '#64748b' }}>Upload menu photos in CMS to see them here!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Find Us Section (Locations & Maps) */}
                    <section id="find-us" style={{ padding: '8rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                                <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem' }}>Find Our Branches</h2>
                                <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Visit us at any of our active locations or mobile stalls.</p>
                                <div style={{ width: '100px', height: '5px', background: 'var(--primary-color)', margin: '1.5rem auto', borderRadius: '10px' }}></div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                                {allLocations.map((loc) => (
                                    <div key={loc.id} style={{ 
                                        background: 'rgba(30, 41, 59, 0.4)', 
                                        borderRadius: '24px', 
                                        padding: '2rem', 
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1.5rem',
                                        transition: 'transform 0.3s'
                                    }}>
                                        <div>
                                            <span style={{ 
                                                background: loc.is_mobile ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                                                color: loc.is_mobile ? '#60a5fa' : '#10b981', 
                                                padding: '0.4rem 1rem', 
                                                borderRadius: '20px', 
                                                fontSize: '0.8rem', 
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                {loc.is_mobile ? '🚚 Mobile Event' : '🏠 Permanent Branch'}
                                            </span>
                                            <h3 style={{ fontSize: '1.75rem', marginTop: '1rem', marginBottom: '0.5rem' }}>{loc.name}</h3>
                                            <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>
                                                📍 {loc.address || 'Address coming soon...'}
                                            </p>
                                            {loc.is_mobile && loc.stall_date && (
                                                <p style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                                    🗓️ Event Date: {loc.stall_date}
                                                </p>
                                            )}
                                        </div>

                                        {loc.google_maps_url && (
                                            <div style={{ marginTop: 'auto' }}>
                                                <a 
                                                    href={loc.google_maps_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        gap: '0.75rem', 
                                                        background: 'var(--primary-color)', 
                                                        color: '#000', 
                                                        padding: '1rem', 
                                                        borderRadius: '12px', 
                                                        textDecoration: 'none', 
                                                        fontWeight: 'bold',
                                                        fontSize: '1rem'
                                                    }}
                                                >
                                                    🗺️ Open in Google Maps
                                                </a>
                                            </div>
                                        )}
                                        
                                        {!loc.google_maps_url && (
                                            <div style={{ 
                                                marginTop: 'auto', 
                                                background: 'rgba(255,255,255,0.02)', 
                                                padding: '1.5rem', 
                                                borderRadius: '12px', 
                                                textAlign: 'center',
                                                border: '1px dashed #334155',
                                                color: '#64748b'
                                            }}>
                                                Map details coming soon!
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {allLocations.length === 0 && (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', fontSize: '1.2rem' }}>We are currently preparing our next locations. Stay tuned!</p>
                                )}
                            </div>
                        </div>
                    </section>
                    
                    <footer style={{ background: '#020617', padding: '4rem 2rem', textAlign: 'center', color: '#4d5569', borderTop: '1px solid #1e293b' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                           <h2 style={{ color: '#f8fafc', marginBottom: '1.5rem' }}>{vendor.name}</h2>
                           <p style={{ maxWidth: '600px', margin: '0 auto 3rem auto', lineHeight: '1.8' }}>
                               {branding.about_text || 'Premium dining experience delivered straight to your neighborhood.'}
                           </p>
                           <p>&copy; {new Date().getFullYear()} {vendor.name}. All rights reserved. Powered by <span style={{ color: '#00e676', fontWeight: 'bold' }}>VulaHub</span>.</p>
                        </div>
                    </footer>
                </div>
            )}

            {view === 'menu' && (
                <div className="order-flow-wrapper">
                    <CustomerMenu vendorId={vendor.id} branding={branding} />
                </div>
            )}

            {view === 'dashboard' && (
                <div className="order-flow-wrapper">
                    <CustomerDashboard vendorId={vendor.id} onBack={() => setView('landing')} />
                </div>
            )}
        </div>
    );
}

export default VendorLandingPage;
