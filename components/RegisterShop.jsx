import React, { useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

export default function RegisterShop() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [shopName, setShopName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const generateSlug = (name) => {
        return name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const slug = generateSlug(shopName);

        try {
            // 1. Check if slug is taken
            const { data: existingVendor } = await supabase
                .from('vendors')
                .select('id')
                .eq('slug', slug)
                .single();

            if (existingVendor) {
                throw new Error('A shop with a similar name already exists. Please try a different name.');
            }

            // 2. Create the Vendor record first to get an ID
            // We do this first because the Auth trigger needs a valid vendor_id
            const { data: newVendor, error: vendorErr } = await supabase
                .from('vendors')
                .insert([{ 
                    name: shopName, 
                    slug: slug,
                    branding: {
                        primary_color: "#00e676",
                        secondary_color: "#1e293b",
                        hero_text: `Welcome to ${shopName}`
                    }
                }])
                .select()
                .single();

            if (vendorErr) throw vendorErr;

            // 3. Sign up the user with vendor_id in metadata
            const { data: authData, error: authErr } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: 'Shop Owner',
                        vendor_id: newVendor.id
                    },
                    emailRedirectTo: `${window.location.origin}/admin`
                }
            });

            if (authErr) {
                // Cleanup vendor if auth fails
                await supabase.from('vendors').delete().eq('id', newVendor.id);
                throw authErr;
            }

            // 4. Manually create profile as a fallback (triggers might be slow)
            // We use the ID from the signUp result
            if (authData?.user?.id) {
                await supabase.from('profiles').insert([{
                    id: authData.user.id,
                    vendor_id: newVendor.id,
                    full_name: 'Shop Owner',
                    role: 'admin'
                }]);
            }

            // Success! 
            alert('Shop registered successfully! You are now being logged in.');
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
            background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
            padding: '20px'
        }}>
            <div className="login-card" style={{
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '3rem',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: '900', 
                        color: '#00e676', 
                        marginBottom: '0.5rem',
                        letterSpacing: '-1.5px'
                    }}>
                        VulaHub
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Start your digital Kota shop</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        padding: '1rem',
                        borderRadius: '12px',
                        marginBottom: '2rem',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>KOTA SHOP NAME</label>
                        <input
                            type="text"
                            required
                            className="kds-input"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="e.g. Mams Kitchen"
                            style={{ 
                                width: '100%', 
                                padding: '14px 16px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>OWNER EMAIL</label>
                        <input
                            type="email"
                            required
                            className="kds-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="owner@yourshop.co.za"
                            style={{ 
                                width: '100%', 
                                padding: '14px 16px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>CHOOSE PASSWORD</label>
                        <input
                            type="password"
                            required
                            className="kds-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{ 
                                width: '100%', 
                                padding: '14px 16px', 
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '1.1rem',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            borderRadius: '14px',
                            background: '#00e676',
                            color: '#000',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'transform 0.2s',
                            border: 'none'
                        }}
                    >
                        {loading ? 'Creating Your Shop...' : 'Launch My Digital Shop'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Already have a shop? <Link to="/login" style={{ color: '#00e676', textDecoration: 'none', fontWeight: 'bold' }}>Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
