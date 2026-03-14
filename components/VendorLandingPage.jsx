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
    const [mobileStalls, setMobileStalls] = useState([]);
    const [featuredMenu, setFeaturedMenu] = useState([]);

    useEffect(() => {
        const fetchVendorData = async () => {
            try {
                setLoading(true);
                const hostname = window.location.hostname;
                let query = supabase.from('vendors').select('*');

                // 1. Detection Logic: Custom Domain vs Sub-path Slug
                if (vendorSlug) {
                    // Force slug if it's in the URL
                    query = query.eq('slug', vendorSlug);
                } else if (hostname !== 'localhost' && !hostname.endsWith('.vercel.app') && !hostname.endsWith('.kotaguard.com')) {
                    // Try to match by custom domain if no slug is provided
                    query = query.eq('custom_domain', hostname);
                } else {
                    // Default to Chef Dips for root path on platform domains
                    query = query.eq('slug', 'chef-dips');
                }

                const { data: vendorData, error: vErr } = await query.single();

                if (vErr || !vendorData) {
                    console.error("Vendor not found:", vErr);
                    // If no slug and no domain match, we might want to redirect to a platform landing page
                    // For now, we'll just stop
                    setLoading(false);
                    return;
                }

                setVendor(vendorData);

                // 2. Apply branding colors to CSS variables
                const branding = vendorData.branding || {};
                document.documentElement.style.setProperty('--color-primary', branding.primary_color || '#00e676');
                document.documentElement.style.setProperty('--color-secondary', branding.secondary_color || '#1e293b');

                // 3. Fetch Vendor's Stalls
                const { data: stalls } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_mobile', true)
                    .eq('is_active', true);
                setMobileStalls(stalls || []);

                // 4. Fetch Vendor's Menu
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

    if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Loading {vendorSlug || 'Kota Guard'}...</div>;
    if (!vendor) return <div style={{ color: '#fff', padding: '2rem' }}>Vendor "{vendorSlug}" not found.</div>;

    const branding = vendor.branding || {};

    return (
        <div className="landing-wrapper">
            <header className="brand-header">
                <div className="brand-logo">{vendor.name}</div>
                <div className="brand-tagline">{branding.tagline || 'Premium Kota Experience'}</div>
            </header>

            {view === 'landing' && (
                <div className="landing-page-scroll">
                    <main className="hero-section" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', padding: '6rem 2rem 2rem 2rem' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
                            <div className="hero-content" style={{ textAlign: 'left', margin: 0 }}>
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    {branding.welcome_text || '"Dumelang chommi tsaka"'}
                                </span>
                                <h1 className="hero-title" style={{ fontSize: '3.5rem', lineHeight: '1.1' }}>
                                    {branding.hero_title || 'Nothing brings people together like'} <span style={{ color: 'var(--primary-color)' }}>{branding.hero_highlight || 'good quality food.'}</span>
                                </h1>
                                <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', opacity: 0.9 }}>
                                    {branding.hero_subtitle || 'Eskort Or Nothing. Kel Rata Zwap.'}
                                </p>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                                    <button className="btn-primary hero-btn" onClick={() => setView('menu')} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem' }}>
                                        Start Online Order
                                    </button>
                                    <button className="btn-secondary hero-btn" onClick={() => setView('dashboard')} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        Track My Order
                                    </button>
                                </div>
                            </div>

                            <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                                <div style={{
                                    aspectRatio: '3/4',
                                    background: branding.hero_image ? `url(${branding.hero_image}) center/cover` : '#1e293b',
                                    borderRadius: '24px',
                                    boxShadow: `0 20px 40px rgba(0, 230, 118, 0.2)`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#94a3b8',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    border: `1px solid var(--primary-color)`
                                }}>
                                    {!branding.hero_image && (
                                        <>
                                            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</span>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f8fafc' }}>Upload your hero photo in CMS</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* About Section */}
                    <section style={{ padding: '6rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', color: '#f8fafc' }}>About {vendor.name}</h2>
                            <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: '1.8', marginBottom: '2rem' }}>
                                {branding.about_text || 'Welcome to our shop! We believe in massive portions, premium ingredients, and that unmistakable South African flavor.'}
                            </p>
                            <div style={{ width: '60px', height: '4px', background: 'var(--primary-color)', margin: '0 auto', borderRadius: '2px' }}></div>
                        </div>
                    </section>

                    {/* Gallery section content omitted for brevity in this first pass refactor */}
                    
                    <footer style={{ background: '#020617', padding: '2rem', textAlign: 'center', color: '#475569', borderTop: '1px solid #1e293b' }}>
                        <p>&copy; {new Date().getFullYear()} {vendor.name}. All rights reserved. Powered by Kota Guard.</p>
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
