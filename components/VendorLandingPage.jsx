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
    const [testimonials, setTestimonials] = useState([]);
    const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
    const [newTestimonial, setNewTestimonial] = useState({ author_name: '', quote: '', author_role: '' });
    const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);

    useEffect(() => {
        const fetchVendorData = async () => {
            try {
                setLoading(true);
                const hostname = window.location.hostname;
                let query = supabase.from('kg_vendors').select('*');

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
                    .from('kg_locations')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_active', true);
                setAllLocations(locs || []);

                // 4. Fetch Featured Menu items
                const { data: menu } = await supabase
                    .from('kg_menu_items')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_available', true)
                    .limit(6);
                setFeaturedMenu(menu || []);

                // 5. Fetch Active Testimonials
                const { data: testData } = await supabase
                    .from('kg_testimonials')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                setTestimonials(testData || []);

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
                    <main className="hero-section" style={{ 
                        minHeight: '90vh', 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '12rem 2rem 4rem 2rem',
                        position: 'relative',
                        background: branding.hero_image ? `url(${branding.hero_image}) center/cover no-repeat` : '#0f172a'
                    }}>
                        {/* Dark scenic overlay for text legibility */}
                        {branding.hero_image && (
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(2,6,23,0.95), rgba(2,6,23,0.7))', zIndex: 1 }}></div>
                        )}
                        
                        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                            <div className="hero-content" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', background: 'rgba(255,255,255,0.03)', padding: '3rem 2rem', borderRadius: '30px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    {branding.welcome_text || '"Dumelang chommi tsaka"'}
                                </span>
                                <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '1.1', fontWeight: '800', textAlign: 'center' }}>
                                    {branding.hero_title || 'Nothing brings people together like'} <span style={{ color: 'var(--primary-color)' }}>{branding.hero_highlight || 'good quality food.'}</span>
                                </h1>
                                <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', opacity: 0.9, color: '#94a3b8', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
                                    {branding.hero_subtitle || 'Eskort Or Nothing. Kel Rata Zwap.'}
                                </p>

                                <div className="hero-buttons" style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button className="btn-primary hero-btn" onClick={() => setView('menu')} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', fontSize: '1.1rem' }}>
                                        Start Online Order
                                    </button>
                                    <button className="btn-secondary hero-btn" onClick={() => document.getElementById('find-us').scrollIntoView({ behavior: 'smooth' })} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
                                        Locations & Maps
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>

                    {/* Featured Menu Section (Top Picks) */}
                    {featuredMenu.length > 0 && (
                        <section style={{ padding: '6rem 2rem', background: '#020617' }}>
                            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                                    <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem' }}>Top Picks</h2>
                                    <p style={{ color: '#94a3b8' }}>Our most loved items, prepared fresh for you.</p>
                                    <div style={{ width: '60px', height: '4px', background: 'var(--primary-color)', margin: '1.5rem auto', borderRadius: '10px' }}></div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                                    {featuredMenu.map((item) => (
                                        <div key={item.id} className="menu-card" style={{ 
                                            background: 'rgba(30, 41, 59, 0.4)', 
                                            borderRadius: '24px', 
                                            overflow: 'hidden',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            transition: 'transform 0.3s'
                                        }}>
                                            <div style={{ 
                                                height: '200px', 
                                                background: item.image_url ? `url(${item.image_url}) center/cover` : 'rgba(255,255,255,0.05)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {!item.image_url && <span style={{ fontSize: '3rem' }}>🍔</span>}
                                            </div>
                                            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.name}</h3>
                                                <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>R {item.price}</p>
                                                <button onClick={() => setView('menu')} style={{ marginTop: '1rem', background: 'transparent', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '0.5rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                    Order Now
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Testimonials Section */}
                    <section style={{ padding: '6rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem', gap: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Customer Love</h2>
                                    <p style={{ color: '#94a3b8' }}>What people are saying about their {vendor.name} experience.</p>
                                </div>
                                <button className="btn-secondary" onClick={() => setIsTestimonialModalOpen(true)} style={{ padding: '0.8rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--primary-color)' }}>
                                    ✏️ Write a Review
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
                                {testimonials.map((t) => (
                                    <div key={t.id} style={{ 
                                        background: 'rgba(30, 41, 59, 0.4)', 
                                        padding: '2rem', 
                                        borderRadius: '24px', 
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ color: '#fbbf24', fontSize: '1.2rem' }}>{"⭐".repeat(5)}</div>
                                        <p style={{ fontStyle: 'italic', color: '#f8fafc', fontSize: '1.1rem', margin: 0, lineHeight: '1.6' }}>"{t.quote}"</p>
                                        <div style={{ marginTop: '1rem' }}>
                                            <div style={{ fontWeight: 'bold' }}>{t.author_name}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{t.author_role || 'Customer'}</div>
                                        </div>
                                    </div>
                                ))}
                                {testimonials.length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        <p style={{ color: '#64748b' }}>Be the first to leave a review! ⭐</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Testimonial Submission Modal */}
                    {isTestimonialModalOpen && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
                            <div style={{ background: '#1e293b', padding: '2.5rem', borderRadius: '32px', width: '100%', maxWidth: '500px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
                                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Share Your Experience</h2>
                                <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Your review will be sent to the owner for approval.</p>
                                
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!newTestimonial.author_name || !newTestimonial.quote) return;
                                    setIsSubmittingTestimonial(true);
                                    try {
                                        const { error } = await supabase.from('kg_testimonials').insert({
                                            vendor_id: vendor.id,
                                            author_name: newTestimonial.author_name,
                                            quote: newTestimonial.quote,
                                            author_role: newTestimonial.author_role,
                                            is_active: false
                                        });
                                        if (error) throw error;
                                        alert("Thank you! Your testimonial has been sent for review. 🎉");
                                        setNewTestimonial({ author_name: '', quote: '', author_role: '' });
                                        setIsTestimonialModalOpen(false);
                                    } catch (err) {
                                        alert("Error: " + err.message);
                                    } finally {
                                        setIsSubmittingTestimonial(false);
                                    }
                                }}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Your Name</label>
                                        <input 
                                            type="text" 
                                            required
                                            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                            value={newTestimonial.author_name}
                                            onChange={e => setNewTestimonial({...newTestimonial, author_name: e.target.value})}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Your Role / Location (Optional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Regular Customer / Johannesburg"
                                            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                                            value={newTestimonial.author_role}
                                            onChange={e => setNewTestimonial({...newTestimonial, author_role: e.target.value})}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Your Review</label>
                                        <textarea 
                                            required
                                            rows="4"
                                            style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', resize: 'none' }}
                                            value={newTestimonial.quote}
                                            onChange={e => setNewTestimonial({...newTestimonial, quote: e.target.value})}
                                        />
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button type="button" className="btn-secondary" onClick={() => setIsTestimonialModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                                        <button type="submit" disabled={isSubmittingTestimonial} className="btn-primary" style={{ flex: 2 }}>
                                            {isSubmittingTestimonial ? 'Submitting...' : 'Send Review'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Find Us Section (Locations & Maps) */}
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
                           <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                               <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.9rem' }}>Terms of Service & Disclaimer</a>
                           </div>
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
                    <CustomerDashboard vendorId={vendor.id} onBack={() => setView('landing')} branding={branding} />
                </div>
            )}
        </div>
    );
}

export default VendorLandingPage;
