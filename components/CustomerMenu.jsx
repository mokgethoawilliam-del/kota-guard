import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';

export default function CustomerMenu({ vendorId, branding }) {
    const [menuItems, setMenuItems] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [vendorDoc, setVendorDoc] = useState(null);

    // Shopping Cart State
    const [cart, setCart] = useState([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    // Form State
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [modifiers, setModifiers] = useState('');
    const [collectionTime, setCollectionTime] = useState('');

    // Arrival State
    const [hasArrived, setHasArrived] = useState(false);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.body.appendChild(script);

        fetchData();
    }, []);

    async function fetchData() {
        if (!vendorId) return;
        try {
            setLoading(true);

            // Fetch Vendor Details (Plan, Keys, etc.)
            const { data: vData } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', vendorId)
                .single();
            if (vData) setVendorDoc(vData);

            // Fetch Menu Items filtered by vendor
            const { data: menuData, error: menuErr } = await supabase
                .from('menu_items')
                .select('*')
                .eq('vendor_id', vendorId)
                .order('price');
            if (menuErr) throw menuErr;
            setMenuItems(menuData);

            // Fetch Locations filtered by vendor
            const { data: locData, error: locErr } = await supabase
                .from('locations')
                .select('*')
                .eq('vendor_id', vendorId);
            if (locErr) throw locErr;
            setLocations(locData);

            if (locData.length > 0) setSelectedLocation(locData[0].id);

        } catch (err) {
            console.error('Error fetching data:', err.message);
        } finally {
            setLoading(false);
        }
    }

    const addToCart = (item) => {
        setCart(current => {
            const existing = current.find(i => i.id === item.id);
            if (existing) {
                return current.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...current, { ...item, qty: 1 }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart(current => current.filter(i => i.id !== itemId));
    };

    const cartTotal = cart.reduce((total, item) => total + (item.price * item.qty), 0);

    const openCheckout = () => {
        if (cart.length === 0) return alert("Your cart is empty");
        setIsCheckoutOpen(true);
    };

    const cancelCheckout = () => {
        setIsCheckoutOpen(false);
        // We keep the details filled in case they just wanted to close the modal temporarily
    };

    const handleBuyNow = async (e) => {
        e.preventDefault();
        if (!customerName || !customerPhone || !selectedLocation) {
            alert('Please fill in your Name, WhatsApp Number, and Location.');
            return;
        }

        // Validate South African Mobile Number (e.g. 081... or +27...)
        const phoneRegex = /^(0|\+27)[6-8][0-9]{8}$/;
        const cleanPhone = customerPhone.replace(/\s+/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            alert('Please enter a valid South African WhatsApp number (e.g. 0812345678). This is strictly required to earn Loyalty Points!');
            return;
        }

        try {
            setProcessingId('processing');

            // 1. Create a "pending" order in Supabase
            const tempOrderNumber = `PND-${Date.now().toString().slice(-4)}`;

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    status: 'pending',
                    vendor_id: vendorId,
                    order_number: tempOrderNumber,
                    location_id: selectedLocation,
                    customer_name: customerName,
                    customer_phone: cleanPhone,
                    total_price: cartTotal,
                    estimated_collection_time: collectionTime || null
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Insert into order_items (Array insertion for the whole cart)
            const orderItemsData = cart.map(item => ({
                order_id: order.id,
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.price,
                modifiers_json: { custom_notes: modifiers }
            }));

            const { error: itemError } = await supabase
                .from('order_items')
                .insert(orderItemsData);

            if (itemError) throw itemError;

            // 3. Initialize Paystack
            // Use Vendor's custom key if provided, otherwise use platform default
            const platformKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'YOUR_TEST_PUBLIC_KEY';
            const vendorKey = vendorDoc?.payment_config?.paystack_public_key;
            
            const paystackKey = vendorKey || platformKey;

            // Split Logic: 5% fee for platform if on free tier and using platform keys
            const subaccount = vendorDoc?.paystack_subaccount_code;
            const splitConfig = (vendorDoc?.plan === 'free' && subaccount) ? {
                subaccount: subaccount,
                bearer: "account", // Vendor pays the transaction fee from their 95%
                transaction_charge: 0, 
                percentage_charge: 5
            } : null;

            const handler = window.PaystackPop.setup({
                key: paystackKey,
                email: `${customerPhone}@whatsapp.kotaguard.com`,
                amount: Math.round(cartTotal * 100),
                currency: 'ZAR',
                subaccount: splitConfig?.subaccount, // Paystack Split
                bearer: splitConfig?.bearer,
                metadata: {
                    order_id: order.id,
                    custom_fields: [
                        { display_name: 'Name', variable_name: 'name', value: customerName },
                        { display_name: 'WhatsApp', variable_name: 'whatsapp', value: customerPhone },
                    ]
                },
                callback: function (response) {
                    (async () => {
                        try {
                            const locName = locations.find(l => l.id === selectedLocation)?.name || 'ot';
                            const prefix = locName.substring(0, 2).toLowerCase();

                            const now = new Date();
                            const mm = String(now.getMonth() + 1).padStart(2, '0');
                            const dd = String(now.getDate()).padStart(2, '0');
                            const dateStr = `${mm}${dd}`;

                            const startOfDay = new Date();
                            startOfDay.setHours(0, 0, 0, 0);

                            const { count } = await supabase
                                .from('orders')
                                .select('*', { count: 'exact', head: true })
                                .eq('location_id', selectedLocation)
                                .neq('status', 'pending')
                                .gte('created_at', startOfDay.toISOString());

                            const dailyNum = String((count || 0) + 1).padStart(3, '0');
                            const finalOrderNum = `${prefix}/${dateStr}/${dailyNum}`;

                            const { error: updateErr } = await supabase
                                .from('orders')
                                .update({
                                    status: 'paid',
                                    order_number: finalOrderNum,
                                    payment_reference: response.reference
                                })
                                .eq('id', order.id);

                            if (updateErr) throw updateErr;

                            setPaymentSuccess(finalOrderNum);
                            setCart([]); // Empty the cart on success!
                        } catch (err) {
                            console.error("Error finalizing order", err);
                            setPaymentSuccess("APPROVED-WAITING-SYNC");
                            setCart([]);
                        } finally {
                            setProcessingId(null);
                            setIsCheckoutOpen(false);
                        }
                    })();
                },
                onClose: function () {
                    console.log('Payment window closed by user.');
                    setProcessingId(null);
                }
            });

            handler.openIframe();
        } catch (err) {
            console.error('Checkout error:', err);
            alert('There was a problem preparing your order. Please try again.');
            setProcessingId(null);
        }
    };

    const handleArrival = async () => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ customer_arrived: true })
                .eq('order_number', paymentSuccess);

            if (error) throw error;
            setHasArrived(true);
            alert("Kitchen Notified! We know you're here. We'll hand over your order shortly.");
        } catch (err) {
            console.error("Could not notify kitchen", err);
            alert("There was an issue notifying the kitchen, please show them your order number.");
        }
    };

    if (paymentSuccess) {
        return (
            <div className="success-container">
                <div className="success-card">
                    <div className="success-icon-wrapper">
                        <span className="success-icon" role="img" aria-label="success"></span>
                    </div>
                    <h1 className="success-headline">Payment Approved</h1>
                    <p className="success-message">Thank you, {customerName}! Your transaction was successful. Kel rata zwap.</p>

                    <div className="order-number-display" style={{ margin: '1.5rem 0', padding: '1.5rem', background: 'rgba(0, 200, 83, 0.1)', border: '1px solid #00C853', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Collection Code</p>
                        <h2 style={{ margin: 0, fontSize: '3.5rem', color: '#00C853', fontWeight: '900', letterSpacing: '4px' }}>
                            {paymentSuccess !== true ? paymentSuccess.split('/').pop() : "..."}
                        </h2>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>Share this code with the staff to collect your order</p>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1.5rem' }}>Official Order ID: {paymentSuccess}</p>

                    {!hasArrived ? (
                        <button
                            className="btn-primary"
                            style={{ width: '100%', marginBottom: '1rem', background: '#3b82f6' }}
                            onClick={handleArrival}
                        >
                             I HAVE ARRIVED AT THE SHOP
                        </button>
                    ) : (
                        <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '8px', marginBottom: '1rem', fontWeight: 'bold' }}>
                             Kitchen has been notified of your arrival.
                        </div>
                    )}

                    <button className="btn-secondary" onClick={() => { setPaymentSuccess(false); setCustomerName(''); setCustomerPhone(''); setModifiers(''); setCollectionTime(''); setHasArrived(false); }}>
                        Back to Menu
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">Loading Menu...</div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <h2 className="page-title">{branding?.name || 'Menu'}</h2>
            <div className="menu-grid">
                {menuItems.map(item => {
                    const incart = cart.find(i => i.id === item.id);
                    return (
                        <div key={item.id} className="menu-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {/* Dynamic CMS Image */}
                            <div style={{
                                height: '180px',
                                background: item.image_url ? `url(${item.image_url}) center/cover` : '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'
                            }}>
                                {!item.image_url && <span style={{ fontSize: '2rem' }}></span>}
                            </div>

                            <div className="menu-card-content" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 className="item-name" style={{ margin: '0 0 0.5rem 0' }}>{item.name}</h3>
                                    <p className="item-price" style={{ margin: 0 }}>R {item.price}</p>
                                </div>
                                <button
                                    className="btn-primary"
                                    onClick={() => addToCart(item)}
                                    style={{ marginTop: '1rem', width: '100%' }}
                                >
                                    {incart ? `Add More (${incart.qty} in cart)` : 'Add to Cart'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Cart Button */}
            {cart.length > 0 && !isCheckoutOpen && (
                <div style={{ position: 'fixed', bottom: '2rem', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                    <button
                        className="btn-primary"
                        style={{ maxWidth: '400px', boxShadow: '0 10px 30px rgba(0, 230, 118, 0.5)' }}
                        onClick={openCheckout}
                    >
                         Checkout {cart.reduce((sum, i) => sum + i.qty, 0)} Items (R {cartTotal})
                    </button>
                </div>
            )}

            {/* Checkout Modal Overlay */}
            {isCheckoutOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Complete Your Order</h3>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            {cart.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>{item.qty}x {item.name}</span>
                                    <span>R {item.price * item.qty}</span>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid #334155', marginTop: '0.5rem', paddingTop: '0.5rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Total:</span>
                                <span>R {cartTotal}</span>
                            </div>
                        </div>

                        <form onSubmit={handleBuyNow} className="checkout-form">
                            <div className="form-group">
                                <label>Collection Location</label>
                                <select
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value)}
                                    required
                                    className="form-input"
                                >
                                    <option value="" disabled>Select Location...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Your Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>WhatsApp Number <b>(Required for Loyalty Points)</b></label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 0812345678"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    required
                                    className="form-input"
                                />
                                <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                                     Enter a valid 10-digit South African number to unlock secret rewards.
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Estimated Collection Time (Optional)</label>
                                <input
                                    type="time"
                                    value={collectionTime}
                                    onChange={(e) => setCollectionTime(e.target.value)}
                                    className="form-input"
                                />
                                <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                                     Let Chef Dips know when you'll arrive so it's fresh off the grill!
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Special Instructions for Entire Order (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Please put Atchaar on the side"
                                    value={modifiers}
                                    onChange={(e) => setModifiers(e.target.value)}
                                    className="form-input"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={cancelCheckout} disabled={processingId !== null}>
                                    Back to Menu
                                </button>
                                <button type="submit" className="btn-primary" disabled={processingId !== null}>
                                    {processingId !== null ? 'Processing...' : `Pay R ${cartTotal}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
