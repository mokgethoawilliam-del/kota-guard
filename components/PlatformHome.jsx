import React from 'react';
import { Link } from 'react-router-dom';

export default function PlatformHome() {
    return (
        <div className="platform-home" style={{ background: '#09090b', color: '#fff', minHeight: '100vh', fontFamily: "'Outfit', sans-serif" }}>
            {/* Navigation */}
            <nav style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#00e676', letterSpacing: '-1px' }}>VulaHub</div>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <a href="#about" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>About</a>
                    <a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>Pricing</a>
                    <a href="#contact" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>Contact</a>
                    <Link to="/login" style={{ color: '#fff', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>Login</Link>
                    <Link to="/register" style={{ background: '#00e676', color: '#000', textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', fontWeight: 'bold' }}>Get Started</Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header style={{ padding: '8rem 2rem', textAlign: 'center', background: 'radial-gradient(circle at center, rgba(0, 230, 118, 0.05) 0%, transparent 70%)' }}>
                <h1 style={{ fontSize: '4.5rem', fontWeight: 900, marginBottom: '1.5rem', letterSpacing: '-2px', lineHeight: 1 }}>
                    Digitalize Your <span style={{ color: '#00e676' }}>Kasi Kitchen.</span>
                </h1>
                <p style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 3rem', lineHeight: 1.6 }}>
                    The all-in-one platform for South African food vendors. Accept payments, manage orders via WhatsApp, and grow your local brand with a premium digital storefront.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Link to="/register" style={{ background: '#00e676', color: '#000', padding: '1.2rem 2.5rem', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none', transition: 'transform 0.2s' }}>
                        Launch Your Shop Free
                    </Link>
                    <a href="#pricing" style={{ color: '#fff', padding: '1.2rem 2.5rem', borderRadius: '15px', fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
                        See Pricing
                    </a>
                </div>
            </header>

            {/* Features (About) Section */}
            <section id="about" style={{ padding: '6rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Built for the Streets, Powered by Tech.</h2>
                    <p style={{ color: '#94a3b8' }}>VulaHub bridges the gap between traditional food and digital excellence.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {[
                        { title: '🟢 WhatsApp Integrated', desc: 'Your customers order directly on WhatsApp. No complex apps to download.', icon: '📱' },
                        { title: '💳 Secure Payments', desc: 'Accept Card, EFT, and 1Vouchers easily with local gateway integrations.', icon: '💰' },
                        { title: '🏪 Custom Branding', desc: 'Get a beautiful, professional website for your kitchen that works on any phone.', icon: '🎨' }
                    ].map((f, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem', borderRadius: '24px' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>{f.icon}</div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{f.title}</h3>
                            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" style={{ padding: '6rem 2rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Simple, Fair Pricing.</h2>
                        <p style={{ color: '#94a3b8' }}>No hidden setup fees. Scale as you grow.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                        {/* Free Tier */}
                        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', padding: '3rem', borderRadius: '32px', position: 'relative' }}>
                            <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Free Forever</h3>
                            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem' }}>R0 <span style={{ fontSize: '1rem', color: '#64748b' }}>/month</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '2.5rem', color: '#cbd5e1' }}>
                                <li style={{ marginBottom: '1rem' }}>✅ Digital Menu & Ordering</li>
                                <li style={{ marginBottom: '1rem' }}>✅ WhatsApp Bot Integration</li>
                                <li style={{ marginBottom: '1rem' }}>✅ POS Kitchen Dashboard</li>
                                <li style={{ color: '#00e676', fontWeight: 'bold' }}>⭐ 5% Platform Transaction Fee</li>
                            </ul>
                            <Link to="/register" style={{ display: 'block', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '1rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.1)' }}>Start Registration</Link>
                        </div>

                        {/* Growth Tier */}
                        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)', border: '1px solid #00e676', padding: '3rem', borderRadius: '32px', transform: 'scale(1.05)', boxShadow: '0 25px 50px -12px rgba(0, 230, 118, 0.2)' }}>
                            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#00e676', color: '#000', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>MOST POPULAR</div>
                            <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Growth</h3>
                            <div style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem' }}>R299 <span style={{ fontSize: '1rem', color: '#000' }}>/month</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '2.5rem', color: '#fff' }}>
                                <li style={{ marginBottom: '1rem' }}>✅ Everything in Free</li>
                                <li style={{ marginBottom: '1rem' }}>✅ Use Your Own API Keys</li>
                                <li style={{ marginBottom: '1rem' }}>✅ Custom Domain Support</li>
                                <li style={{ fontWeight: 'bold' }}>🚀 0% Platform Fees</li>
                            </ul>
                            <Link to="/register" style={{ display: 'block', textAlign: 'center', background: '#fff', color: '#000', padding: '1rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold' }}>Go Premium</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" style={{ padding: '6rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '4rem', borderRadius: '32px' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem', textAlign: 'center' }}>Get in Touch.</h2>
                    <form style={{ display: 'grid', gap: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <input type="text" placeholder="Your Name" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                            <input type="email" placeholder="Email Address" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                        </div>
                        <textarea placeholder="How can we help your kitchen grow?" rows="4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', color: '#fff', outline: 'none', resize: 'none' }}></textarea>
                        <button type="submit" style={{ background: '#00e676', color: '#000', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Send Message</button>
                    </form>
                </div>
            </section>

            {/* Footer */}
            <footer style={{ padding: '4rem 2rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#00e676', marginBottom: '1.5rem' }}>VulaHub</div>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>&copy; 2026 VulaHub. Empowing local vendors through digital innovation.</p>
            </footer>
        </div>
    );
}
