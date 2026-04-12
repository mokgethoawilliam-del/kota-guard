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

    // Phase 12: Logistics & Security PIN
    const [fulfillmentMethod, setFulfillmentMethod] = useState('collection'); // 'collection' | 'delivery'
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [activeOrder, setActiveOrder] = useState(null); // stores order details after success

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

    const selectedLocationDoc = locations.find(l => l.id === selectedLocation);
    const deliveryFee = (fulfillmentMethod === 'delivery' && selectedLocationDoc?.delivery_enabled) ? (selectedLocationDoc.delivery_fee || 0) : 0;
    const cartTotal = cart.reduce((total, item) => total + (item.price * item.qty), 0) + deliveryFee;

    const openCheckout = () => {
        if (cart.length === 0) return alert("Your cart is empty");
        setIsCheckoutOpen(true);
        // Ensure modal starts at the top
        setTimeout(() => {
            const overlay = document.querySelector('.modal-overlay');
            if (overlay) overlay.scrollTop = 0;
        }, 100);
    };

    const cancelCheckout = () => {
        setIsCheckoutOpen(false);
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

            // Generate 4-digit Collection PIN
            const pin = Math.floor(1000 + Math.random() * 9000).toString();

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
                    estimated_collection_time: collectionTime || null,
                    fulfillment_method: fulfillmentMethod,
                    delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress : null,
                    delivery_fee: deliveryFee,
                    collection_pin: pin
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
            // Use Vendor's custom key ONLY. Fallback to platform is removed for security.
            const paystackKey = vendorDoc?.paystack_public_key;
            
            if (!paystackKey) {
                alert("This shop has not configured their payment system yet. Please contact the owner.");
                setLoading(false);
                return;
            }

            // Split Logic: 5% fee for platform if on free tier and using platform keys
            const handler = window.PaystackPop.setup({
                key: paystackKey,
                email: `${customerPhone}@whatsapp.kotaguard.com`,
                amount: Math.round(cartTotal * 100),
                currency: 'ZAR',
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
                                .gte('created_at', startOfDay.toISOString());

                            const dailyNum = String(count || 1).padStart(3, '0');
                            const finalOrderNum = `${prefix}/${dateStr}/${dailyNum}`;

                             const { data: finalBtn, error: finalErr } = await supabase
                                 .from('orders')
                                 .update({
                                     status: 'paid',
                                     order_number: finalOrderNum,
                                     payment_reference: response.reference
                                 })
                                 .eq('id', order.id)
                                 .select('*, locations(name)')
                                 .single();

                             if (finalErr) throw finalErr;

                             setActiveOrder(finalBtn);
                             setPaymentSuccess(finalOrderNum);
                             setCart([]);
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
            <div className="app-container" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '24px', padding: '2rem', maxWidth: '500px', margin: '0 auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: '80px', height: '80px', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid #00e676' }}>
                        <span style={{ fontSize: '2.5rem' }}>✅</span>
                    </div>
                    
                    <h1 style={{ color: '#00e676', marginBottom: '0.5rem' }}>Order Confirmed!</h1>
                    <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Payment approved for Order #{paymentSuccess}</p>
                    
                    {/* PIN SECTION */}
                    <div style={{ background: '#0f172a', border: '2px dashed #334155', borderRadius: '16px', padding: '2rem', marginBottom: '2rem', position: 'relative' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '2px' }}>
                            Secret {activeOrder?.fulfillment_method === 'delivery' ? 'Delivery' : 'Collection'} PIN
                        </p>
                        <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#00e676', letterSpacing: '12px' }}>{activeOrder?.collection_pin || '----'}</div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem', lineHeight: '1.4' }}>
                            {activeOrder?.fulfillment_method === 'delivery' 
                                ? "Give this PIN to the driver when they arrive to confirm delivery." 
                                : "Show this PIN to the staff when collecting your order."}
                        </p>
                    </div>

                    {/* ORDER SUMMARY */}
                    <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ color: '#94a3b8' }}>Status:</span>
                            <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{activeOrder?.status?.toUpperCase() || 'PAID'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ color: '#94a3b8' }}>Method:</span>
                            <span style={{ color: '#fff' }}>{activeOrder?.fulfillment_method === 'delivery' ? '🚚 Delivery' : '🛍️ Collection'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ color: '#94a3b8' }}>Location:</span>
                            <span style={{ color: '#fff' }}>{activeOrder?.locations?.name || 'Local Store'}</span>
                        </div>
                        {activeOrder?.fulfillment_method === 'delivery' && (
                            <div style={{ borderTop: '1px solid #334155', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                                <span style={{ color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🏠 Delivery Address:</span>
                                <span style={{ color: '#fff', fontSize: '0.9rem' }}>{activeOrder?.delivery_address}</span>
                            </div>
                        )}
                    </div>

                    {!hasArrived && activeOrder?.fulfillment_method !== 'delivery' ? (
                        <button
                            className="btn-primary"
                            style={{ width: '100%', marginBottom: '1.5rem', background: '#3b82f6', height: '60px', fontSize: '1.1rem' }}
                            onClick={handleArrival}
                        >
                            📍 I HAVE ARRIVED AT THE SHOP
                        </button>
                    ) : activeOrder?.fulfillment_method !== 'delivery' && (
                        <div style={{ padding: '1.25rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 'bold', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            ✅ Kitchen notified of your arrival.
                        </div>
                    )}

                    <button className="btn-secondary" style={{ width: '100%', height: '50px' }} onClick={() => { setPaymentSuccess(false); setCustomerName(''); setCustomerPhone(''); setModifiers(''); setCollectionTime(''); setHasArrived(false); setActiveOrder(null); }}>
                        Place Another Order
                    </button>
                    
                    <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '1.5rem' }}>
                        Need help? Use the Live Chat on the menu page with order #{paymentSuccess}
                    </p>
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
                                {!item.image_url && <span style={{ fontSize: '2rem' }}>🍔</span>}
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
                        🛒 Checkout {cart.reduce((sum, i) => sum + i.qty, 0)} Items (R {cartTotal})
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
                            {/* 1. Customer Identity */}
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
                                    📱 Enter 10-digit SA number to unlock rewards.
                                </small>
                            </div>

                            {/* 2. Branch Selection */}
                            <div className="form-group" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <label style={{ color: '#60a5fa' }}>📍 Choose Shop/Stall</label>
                                <select
                                    value={selectedLocation}
                                    onChange={(e) => {
                                        setSelectedLocation(e.target.value);
                                        setFulfillmentMethod('collection'); // Reset to collection on branch change
                                    }}
                                    required
                                    className="form-input"
                                    style={{ marginTop: '0.5rem' }}
                                >
                                    <option value="" disabled>Select Location...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. Fulfillment Choice */}
                            <div className="form-group" style={{ marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold' }}>🍽️ How do you want your Kota?</label>
                                
                                {selectedLocationDoc?.delivery_enabled ? (
                                    <>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <button 
                                                type="button"
                                                onClick={() => setFulfillmentMethod('collection')}
                                                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid', borderColor: fulfillmentMethod === 'collection' ? '#00e676' : '#334155', background: fulfillmentMethod === 'collection' ? 'rgba(0, 230, 118, 0.1)' : 'transparent', color: fulfillmentMethod === 'collection' ? '#00e676' : '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
                                            >🛍️ Collection</button>
                                            <button 
                                                type="button"
                                                onClick={() => setFulfillmentMethod('delivery')}
                                                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid', borderColor: fulfillmentMethod === 'delivery' ? '#3b82f6' : '#334155', background: fulfillmentMethod === 'delivery' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: fulfillmentMethod === 'delivery' ? '#3b82f6' : '#94a3b8', cursor: 'pointer', fontWeight: 'bold' }}
                                            >🚚 Delivery (+R {selectedLocationDoc.delivery_fee})</button>
                                        </div>

                                        {fulfillmentMethod === 'delivery' && (
                                            <div style={{ marginTop: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#fff' }}>🏠 Delivery Address</label>
                                                <textarea 
                                                    required
                                                    className="form-input"
                                                    placeholder="Enter street, area, house number..."
                                                    value={deliveryAddress}
                                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                                    style={{ minHeight: '80px', borderRadius: '8px', width: '100%' }}
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', textAlign: 'center' }}>
                                        🛍️ This branch only offers <b>Collection</b>.
                                    </div>
                                )}
                            </div>

                            {/* 4. Scheduling & Extras */}
                            <div className="form-group">
                                <label>Preferred {fulfillmentMethod === 'delivery' ? 'Delivery' : 'Arrival'} Time (Optional)</label>
                                <input
                                    type="time"
                                    value={collectionTime}
                                    onChange={(e) => setCollectionTime(e.target.value)}
                                    className="form-input"
                                />
                                <small style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                                    ⏰ Helps our chefs prepare your order fresh!
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Special Instructions (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Extra sauce, no onions..."
                                    value={modifiers}
                                    onChange={(e) => setModifiers(e.target.value)}
                                    className="form-input"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={cancelCheckout} disabled={processingId !== null}>
                                    Cancel
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
