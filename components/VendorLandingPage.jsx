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

    const [reviewForm, setReviewForm] = useState({ author_name: '', quote: '', rating: 5 });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chats, setChats] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatSessionId, setChatSessionId] = useState(null);
    const [assistantMessages, setAssistantMessages] = useState([]);
    const [assistantLoading, setAssistantLoading] = useState(false);
    const [assistantDraftCart, setAssistantDraftCart] = useState([]);
    const [liveSupportMode, setLiveSupportMode] = useState(false);
    const [activeLegalDoc, setActiveLegalDoc] = useState(null);
    const [reservationForm, setReservationForm] = useState({
        reservation_type: 'table',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        guest_count: 2,
        reservation_date: '',
        reservation_time: '',
        location_id: '',
        occasion: '',
        special_requests: ''
    });
    const [reservationLoading, setReservationLoading] = useState(false);
    const [reservationSuccess, setReservationSuccess] = useState(false);
    const [isHeroCopyVisible, setIsHeroCopyVisible] = useState(true);

    useEffect(() => {
        const fetchVendorData = async () => {
            try {
                setLoading(true);
                const hostname = window.location.hostname;
                let query = supabase.from('public_vendors').select('*');

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
                setAssistantMessages([{
                    sender_type: 'assistant',
                    message: `Hi, I’m ${vendorData.name}'s assistant. I can help you choose from the menu, build your order, or connect you to live support.`
                }]);

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

                // 5. Fetch Testimonials
                const { data: tests } = await supabase
                    .from('testimonials')
                    .select('*')
                    .eq('vendor_id', vendorData.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                setTestimonials(tests || []);
            } catch (err) {
                console.error("General error loading vendor page:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVendorData();
    }, [vendorSlug]);

    useEffect(() => {
        if (view !== 'landing') {
            setIsHeroCopyVisible(true);
            return;
        }

        let revealTimeout;
        const interval = setInterval(() => {
            setIsHeroCopyVisible(false);
            revealTimeout = setTimeout(() => setIsHeroCopyVisible(true), 1400);
        }, 5600);

        return () => {
            clearInterval(interval);
            if (revealTimeout) clearTimeout(revealTimeout);
        };
    }, [view]);

    
    useEffect(() => {
        if (!vendor?.id) return;

        let sessionId = localStorage.getItem('vulahub_chat_session');
        if (!sessionId) {
            sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('vulahub_chat_session', sessionId);
        }
        setChatSessionId(sessionId);

        // Fetch initial history
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('support_chats')
                .select('*')
                .eq('vendor_id', vendor.id)
                .eq('session_identifier', sessionId)
                .order('created_at', { ascending: true });
            if (data) setChats(data);
        };
        fetchHistory();

        // Subscribe to real-time chat updates
        const channel = supabase
            .channel(`chat_${sessionId}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'support_chats', filter: `session_identifier=eq.${sessionId}` }, 
                (payload) => {
                    setChats(current => {
                        const exists = current.find(c => c.id === payload.new.id);
                        if (exists) return current;
                        return [...current, payload.new];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [vendor?.id]);

    const persistDraftCart = (draftCart) => {
        if (!vendor?.id || !Array.isArray(draftCart) || draftCart.length === 0) return;
        const draftKey = `vulahub_draft_cart_${vendor.id}`;
        localStorage.setItem(draftKey, JSON.stringify(draftCart));
    };

    const openDraftOrder = () => {
        if (!assistantDraftCart.length) return;
        persistDraftCart(assistantDraftCart);
        setView('menu');
        setIsChatOpen(false);
    };

    const sendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || !vendor?.id || !chatSessionId) return;

        const msg = chatInput;
        setChatInput('');

        if (liveSupportMode) {
            const { error } = await supabase.from('support_chats').insert({
                vendor_id: vendor.id,
                session_identifier: chatSessionId,
                message: msg,
                sender_type: 'customer'
            });

            if (error) {
                console.error("Failed to send message:", error);
                setChatInput(msg);
            }
            return;
        }

        const nextMessages = [...assistantMessages, { sender_type: 'customer', message: msg }];
        setAssistantMessages(nextMessages);
        setAssistantLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('landing-ai-assistant', {
                body: {
                    vendorId: vendor.id,
                    message: msg,
                    messages: nextMessages
                        .slice(-8)
                        .map(entry => ({
                            role: entry.sender_type === 'customer' ? 'user' : 'assistant',
                            content: entry.message
                        })),
                    draftCart: assistantDraftCart.map(item => ({
                        menu_item_id: item.id,
                        quantity: item.qty
                    }))
                }
            });

            if (error) throw error;

            const draftItems = Array.isArray(data?.draft_cart)
                ? data.draft_cart
                    .map(draftItem => {
                        const menuMatch = featuredMenu.find(menuItem => menuItem.id === draftItem.menu_item_id);
                        if (!menuMatch) return null;
                        return {
                            id: menuMatch.id,
                            name: menuMatch.name,
                            price: Number(menuMatch.price),
                            qty: Number(draftItem.quantity) || 1
                        };
                    })
                    .filter(Boolean)
                : [];

            if (draftItems.length > 0) {
                setAssistantDraftCart(draftItems);
            }

            setAssistantMessages(current => [
                ...current,
                {
                    sender_type: 'assistant',
                    message: data?.reply || "I can help with menu questions, draft an order, or connect you to support."
                }
            ]);

            if (data?.handoff_to_support) {
                setLiveSupportMode(true);
                await supabase.from('support_chats').insert({
                    vendor_id: vendor.id,
                    session_identifier: chatSessionId,
                    message: msg,
                    sender_type: 'customer'
                });
            }
        } catch (error) {
            console.error("Assistant request failed:", error);
            setAssistantMessages(current => [
                ...current,
                {
                    sender_type: 'assistant',
                    message: "I couldn't finish that just now. You can keep ordering here, or I can hand you over to live support."
                }
            ]);
        } finally {
            setAssistantLoading(false);
        }
    };

    const submitReview = async (e) => {
        e.preventDefault();
        if (!reviewForm.author_name) return;
        setIsSubmittingReview(true);
        try {
            const { error } = await supabase.from('testimonials').insert({
                vendor_id: vendor.id,
                author_name: reviewForm.author_name,
                quote: reviewForm.quote || null,
                rating: reviewForm.rating,
                is_active: false // Require admin approval
            });
            if (error) throw error;
            setReviewSubmitted(true);
            setReviewForm({ author_name: '', quote: '', rating: 5 });
        } catch (err) {
            alert('Error submitting review: ' + err.message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const submitReservation = async (e) => {
        e.preventDefault();
        if (!vendor?.id || !reservationForm.customer_name || !reservationForm.customer_phone || !reservationForm.reservation_date) return;

        setReservationLoading(true);
        try {
            const payload = {
                vendor_id: vendor.id,
                location_id: reservationForm.location_id || null,
                reservation_type: reservationForm.reservation_type,
                customer_name: reservationForm.customer_name.trim(),
                customer_phone: reservationForm.customer_phone.trim(),
                customer_email: reservationForm.customer_email.trim() || null,
                guest_count: Number(reservationForm.guest_count || 1),
                reservation_date: reservationForm.reservation_date,
                reservation_time: reservationForm.reservation_time || null,
                occasion: reservationForm.occasion.trim() || null,
                special_requests: reservationForm.special_requests.trim() || null,
            };

            const { error } = await supabase.from('reservations').insert(payload);
            if (error) throw error;

            setReservationSuccess(true);
            setReservationForm({
                reservation_type: 'table',
                customer_name: '',
                customer_phone: '',
                customer_email: '',
                guest_count: 2,
                reservation_date: '',
                reservation_time: '',
                location_id: '',
                occasion: '',
                special_requests: ''
            });
        } catch (err) {
            alert('Reservation request failed: ' + err.message);
        } finally {
            setReservationLoading(false);
        }
    };

    if (loading) return <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading {vendorSlug || 'VulaHub'}...</div>;
    if (!vendor) return <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Vendor "{vendorSlug}" not found.</div>;

    const branding = vendor.branding || {};
    const landingLogoUrl = vendor.logo_url || branding.logo_url || '';
    const reservationsEnabled = Boolean(branding.enable_reservations);
    const contactEmail = (branding.contact_email || '').trim();
    const contactWhatsapp = (branding.contact_whatsapp || '').trim();
    const whatsappDigits = contactWhatsapp.replace(/\D/g, '');
    const whatsappLinkNumber = whatsappDigits.startsWith('0')
        ? `27${whatsappDigits.slice(1)}`
        : whatsappDigits;
    const hasContactSection = Boolean(contactEmail || contactWhatsapp);

    return (
        <div className="landing-wrapper" style={{ background: '#0f172a', color: '#f8fafc', position: 'relative', minHeight: '100vh' }}>
            <header className="brand-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   {view !== 'landing' && (
                       <button onClick={() => setView('landing')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           ← Home
                       </button>
                   )}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                       {landingLogoUrl ? (
                           <img
                               src={landingLogoUrl}
                               alt={`${vendor.name} logo`}
                               style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}
                           />
                       ) : (
                           <div style={{ width: '48px', height: '48px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', fontWeight: '800', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                               {(vendor.name || 'V').slice(0, 1).toUpperCase()}
                           </div>
                       )}
                       <div>
                           <div className="brand-logo" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{vendor.name}</div>
                           <div className="brand-tagline" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{branding.tagline || 'Signature Food Experience'}</div>
                       </div>
                   </div>
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
                        background: branding.hero_image ? `linear-gradient(rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0.7)), url(${branding.hero_image}) center / 100% auto no-repeat` : '#0f172a'
                    }}>
                        <div className="hero-grid">
                            <div className="hero-content">
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    {branding.welcome_text || 'Welcome to our kitchen'}
                                </span>
                                <div style={{ transition: 'opacity 1s ease, transform 1s ease', opacity: isHeroCopyVisible ? 1 : 0.08, transform: isHeroCopyVisible ? 'translateY(0)' : 'translateY(10px)' }}>
                                    <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '1.1', fontWeight: '800' }}>
                                        {branding.hero_title || 'Good food for'} <span style={{ color: 'var(--primary-color)' }}>{branding.hero_highlight || 'every occasion.'}</span>
                                    </h1>
                                    <p className="hero-subtitle" style={{ fontSize: '1.25rem', marginTop: '1.5rem', opacity: 0.9, color: '#94a3b8' }}>
                                        {branding.hero_subtitle || (reservationsEnabled
                                            ? 'Order online, book a table, or connect with the team in a few taps.'
                                            : 'Order online, explore the menu, or connect with the team in a few taps.')}
                                    </p>
                                </div>

                                <div className="hero-buttons" style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap' }}>
                                    <button className="btn-primary hero-btn" onClick={() => setView('menu')} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', fontSize: '1.1rem' }}>
                                        Start Online Order
                                    </button>
                                    {reservationsEnabled && (
                                        <button className="btn-secondary hero-btn" onClick={() => document.getElementById('book-with-us')?.scrollIntoView({ behavior: 'smooth' })} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
                                            Book a Table / Venue
                                        </button>
                                    )}
                                    <button className="btn-secondary hero-btn" onClick={() => document.getElementById('find-us').scrollIntoView({ behavior: 'smooth' })} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
                                        Locations & Maps
                                    </button>
                                    {hasContactSection && (
                                        <button className="btn-secondary hero-btn" onClick={() => document.getElementById('contact-us')?.scrollIntoView({ behavior: 'smooth' })} style={{ flex: '1 1 200px', maxWidth: '250px', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
                                            Contact Us
                                        </button>
                                    )}
                                </div>
                            </div>

                             <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                                {/* Image moved to main background for better impact */}
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
                                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}></span>
                                        <p style={{ color: '#64748b' }}>Upload menu photos in CMS to see them here!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {reservationsEnabled && <section id="book-with-us" style={{ padding: '8rem 2rem', background: '#0f172a' }}>
                        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                            <div>
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                    Reservations
                                </span>
                                <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem' }}>Book a table or reserve the venue</h2>
                                <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '1.05rem' }}>
                                    If this business takes seated bookings or private venue requests, send your reservation here and the team will confirm it from the admin side.
                                </p>
                                <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.85rem', color: '#cbd5e1' }}>
                                    <div>• Choose table booking or venue booking</div>
                                    <div>• Pick your preferred date, time, and branch</div>
                                    <div>• Add guest count and occasion notes</div>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(30, 41, 59, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2rem' }}>
                                {reservationSuccess ? (
                                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#d1fae5' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
                                        <h3 style={{ marginBottom: '0.5rem', color: '#34d399' }}>Reservation request sent</h3>
                                        <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>
                                            The business has received your booking request and can now confirm it from their admin dashboard.
                                        </p>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            style={{ marginTop: '1rem' }}
                                            onClick={() => setReservationSuccess(false)}
                                        >
                                            Make another booking
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={submitReservation} style={{ display: 'grid', gap: '1rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Booking Type</label>
                                                <select value={reservationForm.reservation_type} onChange={(e) => setReservationForm({ ...reservationForm, reservation_type: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }}>
                                                    <option value="table">Table Booking</option>
                                                    <option value="venue">Venue Booking</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Guests</label>
                                                <input type="number" min="1" required value={reservationForm.guest_count} onChange={(e) => setReservationForm({ ...reservationForm, guest_count: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Your Name</label>
                                            <input required value={reservationForm.customer_name} onChange={(e) => setReservationForm({ ...reservationForm, customer_name: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>WhatsApp Number</label>
                                                <input required value={reservationForm.customer_phone} onChange={(e) => setReservationForm({ ...reservationForm, customer_phone: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Email</label>
                                                <input type="email" value={reservationForm.customer_email} onChange={(e) => setReservationForm({ ...reservationForm, customer_email: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: allLocations.length ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Date</label>
                                                <input type="date" required value={reservationForm.reservation_date} onChange={(e) => setReservationForm({ ...reservationForm, reservation_date: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Time</label>
                                                <input type="time" value={reservationForm.reservation_time} onChange={(e) => setReservationForm({ ...reservationForm, reservation_time: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                            </div>
                                            {allLocations.length > 0 && (
                                                <div>
                                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Branch</label>
                                                    <select value={reservationForm.location_id} onChange={(e) => setReservationForm({ ...reservationForm, location_id: e.target.value })} style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }}>
                                                        <option value="">Any branch</option>
                                                        {allLocations.map((loc) => (
                                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Occasion</label>
                                            <input value={reservationForm.occasion} onChange={(e) => setReservationForm({ ...reservationForm, occasion: e.target.value })} placeholder="Birthday, meeting, private function..." style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc' }} />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.4rem' }}>Special Requests</label>
                                            <textarea rows="4" value={reservationForm.special_requests} onChange={(e) => setReservationForm({ ...reservationForm, special_requests: e.target.value })} placeholder="Seating preference, decor, catering notes..." style={{ width: '100%', padding: '0.95rem', borderRadius: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', resize: 'vertical' }} />
                                        </div>

                                        <button type="submit" className="btn-primary" disabled={reservationLoading} style={{ padding: '1rem', fontSize: '1rem' }}>
                                            {reservationLoading ? 'Sending...' : 'Send Reservation Request'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </section>}

                    {hasContactSection && (
                        <section id="contact-us" style={{ padding: '8rem 2rem', background: '#020617' }}>
                            <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'stretch' }}>
                                <div>
                                    <span style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>
                                        Contact
                                    </span>
                                    <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem' }}>Reach the team directly</h2>
                                    <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '1.05rem' }}>
                                        Need to ask something before ordering, confirm a booking detail, or chat with the business directly? Use the contact details below.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(30, 41, 59, 0.82)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2rem', display: 'grid', gap: '1rem' }}>
                                    {contactWhatsapp && (
                                        <div style={{ padding: '1rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.85)' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1.3px', marginBottom: '0.35rem' }}>WhatsApp</div>
                                            <div style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.85rem', wordBreak: 'break-word' }}>{contactWhatsapp}</div>
                                            {whatsappLinkNumber && (
                                                <a
                                                    href={`https://wa.me/${whatsappLinkNumber}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.85rem 1.1rem', borderRadius: '12px', background: 'var(--primary-color)', color: '#03140b', textDecoration: 'none', fontWeight: '800' }}
                                                >
                                                    Open WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {contactEmail && (
                                        <div style={{ padding: '1rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.85)' }}>
                                            <div style={{ color: '#94a3b8', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1.3px', marginBottom: '0.35rem' }}>Email</div>
                                            <div style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.85rem', wordBreak: 'break-word' }}>{contactEmail}</div>
                                            <a
                                                href={`mailto:${contactEmail}`}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.85rem 1.1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc', textDecoration: 'none', fontWeight: '700' }}
                                            >
                                                Send Email
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

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
                                                {loc.is_mobile ? ' Mobile Event' : ' Permanent Branch'}
                                            </span>
                                            <h3 style={{ fontSize: '1.75rem', marginTop: '1rem', marginBottom: '0.5rem' }}>{loc.name}</h3>
                                            <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>
                                                 {loc.address || 'Address coming soon...'}
                                            </p>
                                            {loc.office_hours && (
                                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                                     {loc.office_hours}
                                                </p>
                                            )}
                                        </div>
                                        {loc.google_maps_url && (
                                            <a href={loc.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '1rem', background: '#334155', color: '#f8fafc', textDecoration: 'none', borderRadius: '12px', fontWeight: 'bold' }}>
                                                🗺️ View on Maps
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Testimonials Section */}
                    <section style={{ padding: '8rem 2rem', background: '#020617' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                            <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
                                <h1 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '1rem' }}>The Streets <span style={{ color: 'var(--primary-color)' }}>Talk</span></h1>
                                <p style={{ color: '#94a3b8', fontSize: '1.2rem' }}>What our foodies are saying about us.</p>
                            </div>

                            {testimonials.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                    {testimonials.map((test) => (
                                        <div key={test.id} style={{ 
                                            background: '#1e293b', 
                                            padding: '2rem', 
                                            borderRadius: '16px', 
                                            border: '1px solid #334155',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            position: 'relative'
                                        }}>
                                            <span style={{ fontSize: '3rem', color: 'var(--color-primary, #00e676)', opacity: 0.2, position: 'absolute', top: '10px', left: '20px' }}>"</span>
                                            <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '1rem', zIndex: 1 }}>
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <span key={star} style={{ color: star <= (test.rating || 5) ? '#fbbf24' : '#334155', fontSize: '1.2rem' }}>★</span>
                                                ))}
                                            </div>
                                            {test.quote && <p style={{ color: '#cbd5e1', fontSize: '1.1rem', lineHeight: '1.8', fontStyle: 'italic', marginBottom: '1.5rem', zIndex: 1 }}>"{test.quote}"</p>}
                                            <div style={{ marginTop: 'auto', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                                                <strong style={{ color: '#f8fafc', display: 'block', fontSize: '1.1rem' }}>{test.author_name}</strong>
                                                {test.author_role && <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{test.author_role}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '1.2rem', marginBottom: '4rem' }}>No reviews yet. Be the first to share your experience!</p>
                            )}

                            {/* Leave a Review Form */}
                            <div style={{ background: '#0f172a', padding: '3rem', borderRadius: '16px', border: '1px solid #334155', maxWidth: '600px', margin: '0 auto' }}>
                                <h3 style={{ color: '#f8fafc', fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Leave a Review</h3>
                                
                                {reviewSubmitted ? (
                                    <div style={{ textAlign: 'center', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                        <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#34d399' }}>Thank You!</h4>
                                        <p>Your review has been submitted and is currently pending moderation.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your Name</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={reviewForm.author_name}
                                                onChange={e => setReviewForm({ ...reviewForm, author_name: e.target.value })}
                                                style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '1rem' }}
                                                placeholder="e.g. Thabo M."
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Rating</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <button 
                                                        key={star} 
                                                        type="button"
                                                        onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                                        style={{ 
                                                            background: 'none', 
                                                            border: 'none', 
                                                            fontSize: '2rem', 
                                                            cursor: 'pointer',
                                                            color: star <= reviewForm.rating ? '#fbbf24' : '#334155',
                                                            transition: 'color 0.2s',
                                                            padding: 0
                                                        }}
                                                    >
                                                        ★
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Your Experience (Optional)</label>
                                            <textarea 
                                                value={reviewForm.quote}
                                                onChange={e => setReviewForm({ ...reviewForm, quote: e.target.value })}
                                                style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '1rem', minHeight: '120px', resize: 'vertical' }}
                                                placeholder="Tell us what you loved..."
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            disabled={isSubmittingReview}
                                            style={{ 
                                                background: 'var(--color-primary, #00e676)', 
                                                color: '#000', 
                                                padding: '1rem', 
                                                borderRadius: '8px', 
                                                fontWeight: 'bold', 
                                                fontSize: '1rem',
                                                border: 'none',
                                                cursor: isSubmittingReview ? 'not-allowed' : 'pointer',
                                                transition: 'opacity 0.2s',
                                                opacity: isSubmittingReview ? 0.7 : 1
                                            }}
                                        >
                                            {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </section>
                    
                    <footer style={{ background: '#020617', padding: '4rem 2rem', textAlign: 'center', color: '#4d5569', borderTop: '1px solid #1e293b' }}>
                        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                           <h2 style={{ color: '#f8fafc', marginBottom: '1.5rem' }}>{vendor.name}</h2>
                           <p style={{ maxWidth: '600px', margin: '0 auto 3rem auto', lineHeight: '1.8' }}>
                               {branding.about_text || 'Fresh flavours, warm hospitality, and service shaped around your business and your guests.'}
                           </p>
                           <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                               <button
                                   type="button"
                                   onClick={() => setActiveLegalDoc('terms')}
                                   style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: '600' }}
                               >
                                   Terms & Conditions
                               </button>
                               <button
                                   type="button"
                                   onClick={() => setActiveLegalDoc('privacy')}
                                   style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: '600' }}
                               >
                                   Privacy Policy
                               </button>
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
                    <CustomerDashboard vendorId={vendor.id} onBack={() => setView('landing')} />
                </div>
            )}

            {/* ── FLOATING LIVE SUPPORT CHAT */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {isChatOpen ? (
                   <div className="chat-window-glass" style={{ width: 'clamp(300px, 90vw, 380px)', height: '500px', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '1rem' }}>
                       <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '10px', height: '10px', background: liveSupportMode ? '#60a5fa' : '#00e676', borderRadius: '50%', boxShadow: `0 0 10px ${liveSupportMode ? '#60a5fa' : '#00e676'}` }}></div>
                                <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{liveSupportMode ? 'Live Support' : 'AI Assistant'}</span>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem', padding: '0.5rem' }}>×</button>
                       </div>

                       <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'transparent' }}>
                            {(liveSupportMode ? [...assistantMessages, ...chats] : assistantMessages).length === 0 && (
                                <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontSize: '0.9rem' }}>
                                    👋 Hi! Tell us how we can help you today.
                                </div>
                            )}
                            {(liveSupportMode ? [...assistantMessages, ...chats] : assistantMessages).map((chat, idx) => (
                                <div key={idx} style={{ 
                                    alignSelf: chat.sender_type === 'customer' ? 'flex-end' : 'flex-start',
                                    background: chat.sender_type === 'customer' ? 'var(--color-primary, #00e676)' : (chat.sender_type === 'assistant' ? 'rgba(99,102,241,0.22)' : '#1e293b'),
                                    color: chat.sender_type === 'customer' ? '#000' : '#fff',
                                    padding: '0.8rem 1.2rem',
                                    borderRadius: chat.sender_type === 'customer' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    maxWidth: '85%',
                                    fontSize: '0.95rem',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                    lineHeight: '1.4'
                                }}>
                                    {chat.message}
                                </div>
                            ))}
                            {assistantLoading && (
                                <div style={{ alignSelf: 'flex-start', background: 'rgba(99,102,241,0.18)', color: '#fff', padding: '0.8rem 1.2rem', borderRadius: '18px 18px 18px 4px', maxWidth: '85%', fontSize: '0.95rem' }}>
                                    Thinking...
                                </div>
                            )}
                       </div>

                       {!liveSupportMode && assistantDraftCart.length > 0 && (
                            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.28)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button type="button" onClick={openDraftOrder} style={{ background: 'var(--color-primary, #00e676)', border: 'none', borderRadius: '999px', padding: '0.75rem 1rem', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>
                                    Review Draft Order ({assistantDraftCart.reduce((sum, item) => sum + item.qty, 0)})
                                </button>
                                <button type="button" onClick={() => setAssistantDraftCart([])} style={{ background: 'transparent', border: '1px solid #334155', borderRadius: '999px', padding: '0.75rem 1rem', cursor: 'pointer', color: '#cbd5e1' }}>
                                    Clear Draft
                                </button>
                            </div>
                       )}

                       <form onSubmit={sendMessage} style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input 
                                    type="text" 
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={liveSupportMode ? "Type your message for support..." : "Ask about the menu or build your order..."}
                                    style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '0.8rem 1.2rem', color: '#fff', outline: 'none' }}
                                />
                                <button type="submit" style={{ background: 'var(--color-primary, #00e676)', border: 'none', borderRadius: '12px', padding: '0.8rem 1.2rem', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>
                                    Send
                                </button>
                            </div>
                       </form>
                   </div>
                ) : (
                    <button 
                        onClick={() => setIsChatOpen(true)}
                        style={{ 
                            width: '64px', 
                            height: '64px', 
                            borderRadius: '50%', 
                            background: 'var(--color-primary, #00e676)', 
                            border: 'none', 
                            color: '#000', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            boxShadow: '0 10px 30px rgba(0,230,118,0.4)', 
                            cursor: 'pointer',
                            fontSize: '1.5rem'
                        }}
                    >
                        💬
                    </button>
                )}
            </div>

            {activeLegalDoc && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2, 6, 23, 0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                    <div style={{ width: 'min(860px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <div>
                                <div style={{ color: 'var(--primary-color)', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                                    Legal
                                </div>
                                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.4rem' }}>
                                    {activeLegalDoc === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveLegalDoc(null)}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '12px', padding: '0.65rem 0.9rem', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', color: '#cbd5e1', lineHeight: '1.8' }}>
                            {activeLegalDoc === 'terms' ? (
                                <>
                                    <p>
                                        By using this website to browse the menu, place orders, submit booking requests, or contact <strong>{vendor.name}</strong>, you agree to use the service lawfully and provide accurate information.
                                    </p>
                                    <p>
                                        Orders, bookings, fulfilment times, availability, pricing, refunds, and service delivery are managed by the vendor operating this storefront. Product availability may change without notice, and submitted requests are subject to confirmation by the business.
                                    </p>
                                    <p>
                                        If you place an order or submit a reservation request, you are responsible for supplying the correct contact details, collection or delivery information, and any relevant booking notes. The business may contact you to confirm or adjust your request.
                                    </p>
                                    <p>
                                        VulaHub provides the software that powers this storefront, but food quality, hygiene, fulfilment, venue service, and direct customer service obligations remain the responsibility of the vendor.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        This storefront may collect personal details you submit directly, such as your name, WhatsApp number, email address, order details, reservation details, and support messages. That information is used to process orders, confirm bookings, provide support, and operate the storefront experience.
                                    </p>
                                    <p>
                                        Information submitted on this site is shared with <strong>{vendor.name}</strong> for business operations and may also be processed by VulaHub as the platform provider for hosting, order management, reservations, analytics, and related communications.
                                    </p>
                                    <p>
                                        Payment information is handled through the configured payment provider and is not stored in full on the public storefront. Contact details may be used to send order updates, booking confirmations, or support follow-ups relevant to your interaction with the business.
                                    </p>
                                    <p>
                                        If you want your information corrected or removed, contact the business directly using the details on this website, or reach out to platform support where applicable.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VendorLandingPage;
