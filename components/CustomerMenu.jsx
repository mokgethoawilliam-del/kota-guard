import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import {
    clearCart,
    consumeCheckoutOpen,
    getSavedCart,
    mergeDraftCart,
    saveCart,
} from '../src/customerCart';

export default function CustomerMenu({ vendorId, vendorName, branding, onBack, cartOpenSignal = 0 }) {
    const [menuItems, setMenuItems] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [vendorDoc, setVendorDoc] = useState(null);

    const [cart, setCart] = useState([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [modifiers, setModifiers] = useState('');
    const [collectionTime, setCollectionTime] = useState('');
    const [fulfillmentMethod, setFulfillmentMethod] = useState('collection');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    const [hasArrived, setHasArrived] = useState(false);
    const [collectionPin, setCollectionPin] = useState(null);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    useEffect(() => {
        if (!vendorId) return;

        const initialCart = mergeDraftCart(vendorId);
        setCart(initialCart);
        if (consumeCheckoutOpen(vendorId) && initialCart.length > 0) {
            setIsCheckoutOpen(true);
        }

        const syncCart = (event) => {
            if (event?.detail?.vendorId && event.detail.vendorId !== vendorId) return;
            setCart(getSavedCart(vendorId));
        };

        window.addEventListener('storage', syncCart);
        window.addEventListener('vulahub-cart-updated', syncCart);

        return () => {
            window.removeEventListener('storage', syncCart);
            window.removeEventListener('vulahub-cart-updated', syncCart);
        };
    }, [vendorId]);

    useEffect(() => {
        fetchData();
    }, [vendorId]);

    useEffect(() => {
        if (cartOpenSignal > 0 && cart.length > 0) {
            setIsCheckoutOpen(true);
        }
    }, [cartOpenSignal, cart.length]);

    async function fetchData() {
        if (!vendorId) return;
        try {
            setLoading(true);

            const { data: vData } = await supabase
                .from('public_vendors')
                .select('*')
                .eq('id', vendorId)
                .single();
            if (vData) setVendorDoc(vData);

            const { data: menuData, error: menuErr } = await supabase
                .from('menu_items')
                .select('*')
                .eq('vendor_id', vendorId)
                .order('price');
            if (menuErr) throw menuErr;
            const visibleMenuItems = (menuData || []).filter((item) => item?.is_available !== false);
            setMenuItems(visibleMenuItems.length > 0 ? visibleMenuItems : (menuData || []));

            const { data: locData, error: locErr } = await supabase
                .from('locations')
                .select('*')
                .eq('vendor_id', vendorId)
                .eq('is_active', true);
            if (locErr) throw locErr;
            setLocations(locData || []);
        } catch (err) {
            console.error('Error fetching data:', err.message);
        } finally {
            setLoading(false);
        }
    }

    const deliveryLocations = useMemo(
        () => locations.filter((loc) => Boolean(loc.delivery_enabled)),
        [locations],
    );

    const selectableLocations = useMemo(() => {
        if (fulfillmentMethod === 'delivery') {
            return deliveryLocations;
        }
        return locations;
    }, [deliveryLocations, fulfillmentMethod, locations]);

    useEffect(() => {
        if (!selectableLocations.length) {
            setSelectedLocation('');
            return;
        }
        if (!selectableLocations.some((loc) => loc.id === selectedLocation)) {
            setSelectedLocation(selectableLocations[0].id);
        }
    }, [selectableLocations, selectedLocation]);

    useEffect(() => {
        if (fulfillmentMethod === 'delivery' && deliveryLocations.length === 0) {
            setFulfillmentMethod('collection');
        }
    }, [deliveryLocations.length, fulfillmentMethod]);

    const selectedLocationRecord = selectableLocations.find((loc) => loc.id === selectedLocation) || null;
    const buyerPaymentsAvailable = Boolean(vendorDoc?.payment_config?.paystack_public_key);
    const itemCount = cart.reduce((total, item) => total + item.qty, 0);
    const cartSubtotal = cart.reduce((total, item) => total + (Number(item.price) * item.qty), 0);
    const deliveryFee = fulfillmentMethod === 'delivery' ? Number(selectedLocationRecord?.delivery_fee || 0) : 0;
    const grandTotal = cartSubtotal + deliveryFee;

    const updateCart = (nextCart) => {
        setCart(nextCart);
        saveCart(vendorId, nextCart);
    };

    const addToCart = (item) => {
        const existing = cart.find((entry) => entry.id === item.id);
        if (existing) {
            updateCart(cart.map((entry) => (
                entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry
            )));
            return;
        }

        updateCart([
            ...cart,
            {
                id: item.id,
                name: item.name,
                price: Number(item.price),
                qty: 1,
            },
        ]);
    };

    const changeQty = (itemId, nextQty) => {
        if (nextQty <= 0) {
            updateCart(cart.filter((entry) => entry.id !== itemId));
            return;
        }
        updateCart(cart.map((entry) => (
            entry.id === itemId ? { ...entry, qty: nextQty } : entry
        )));
    };

    const removeFromCart = (itemId) => {
        updateCart(cart.filter((entry) => entry.id !== itemId));
    };

    const openCheckout = () => {
        if (cart.length === 0) {
            alert('Your cart is empty');
            return;
        }
        if (!buyerPaymentsAvailable) {
            alert('Payment service is currently unavailable.');
            return;
        }
        setIsCheckoutOpen(true);
    };

    const cancelCheckout = () => {
        setIsCheckoutOpen(false);
    };

    const handleBuyNow = async (e) => {
        e.preventDefault();
        if (!customerName || !customerPhone || !selectedLocation) {
            alert('Please fill in your Name, WhatsApp Number, and location.');
            return;
        }

        if (fulfillmentMethod === 'delivery' && !deliveryAddress.trim()) {
            alert('Please add a delivery address.');
            return;
        }

        const phoneRegex = /^(0|\+27)[6-8][0-9]{8}$/;
        const cleanPhone = customerPhone.replace(/\s+/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            alert('Please enter a valid South African WhatsApp number (e.g. 0812345678).');
            return;
        }

        try {
            setProcessingId('processing');

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
                    total_price: grandTotal,
                    estimated_collection_time: fulfillmentMethod === 'collection' ? (collectionTime || null) : null,
                    fulfillment_method: fulfillmentMethod,
                    delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress.trim() : null,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const orderItemsData = cart.map((item) => ({
                order_id: order.id,
                menu_item_id: item.id,
                quantity: item.qty,
                price_at_time: item.price,
                unit_price: item.price,
                modifiers_json: { custom_notes: modifiers },
            }));

            const { error: itemError } = await supabase
                .from('order_items')
                .insert(orderItemsData);

            if (itemError) throw itemError;

            const vendorKey = vendorDoc?.payment_config?.paystack_public_key;
            if (!vendorKey) {
                throw new Error('Payment service is currently unavailable.');
            }

            const subaccount = vendorDoc?.paystack_subaccount_code;
            const splitConfig = (vendorDoc?.plan === 'free' && subaccount) ? {
                subaccount,
                bearer: 'account',
                transaction_charge: 0,
                percentage_charge: 5,
            } : null;

            const handler = window.PaystackPop.setup({
                key: vendorKey,
                email: `${customerPhone}@whatsapp.kotaguard.com`,
                amount: Math.round(grandTotal * 100),
                currency: 'ZAR',
                subaccount: splitConfig?.subaccount,
                bearer: splitConfig?.bearer,
                metadata: {
                    order_id: order.id,
                    custom_fields: [
                        { display_name: 'Name', variable_name: 'name', value: customerName },
                        { display_name: 'WhatsApp', variable_name: 'whatsapp', value: customerPhone },
                        { display_name: 'Fulfilment', variable_name: 'fulfilment', value: fulfillmentMethod },
                    ],
                },
                callback: function (response) {
                    (async () => {
                        try {
                            const { data, error } = await supabase.functions.invoke('finalize-order-payment', {
                                body: {
                                    order_id: order.id,
                                    reference: response.reference,
                                },
                            });

                            if (error) throw error;
                            if (!data?.order_number) throw new Error('Payment verified, but no order number was returned.');

                            setCollectionPin(data.collection_pin);
                            setPaymentSuccess(data.order_number);
                            clearCart(vendorId);
                            setCart([]);
                        } catch (err) {
                            console.error('Error finalizing order', err);
                            setPaymentSuccess('APPROVED-WAITING-SYNC');
                            clearCart(vendorId);
                            setCart([]);
                        } finally {
                            setProcessingId(null);
                            setIsCheckoutOpen(false);
                        }
                    })();
                },
                onClose: function () {
                    setProcessingId(null);
                },
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
            const { error } = await supabase.rpc('mark_customer_arrived', {
                p_order_number: paymentSuccess,
            });

            if (error) throw error;
            setHasArrived(true);
            alert("Kitchen notified. We'll hand over your order shortly.");
        } catch (err) {
            console.error('Could not notify kitchen', err);
            alert('There was an issue notifying the kitchen. Please show them your order number.');
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
                    <p className="success-message">Thank you, {customerName}. Your transaction was successful.</p>

                    <div style={{ margin: '1.5rem 0', padding: '1.5rem', background: 'rgba(0, 200, 83, 0.1)', border: '1px solid #00C853', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Secret Collection PIN</p>
                        <h2 style={{ margin: 0, fontSize: '4rem', color: '#00C853', fontWeight: '900', letterSpacing: '8px' }}>
                            {collectionPin || '...'}
                        </h2>
                        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ef4444', fontWeight: '600' }}>Show this PIN to the vendor when collecting. It expires once used.</p>
                    </div>

                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'left' }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>Order Reference: <strong style={{ color: '#fff' }}>{paymentSuccess}</strong></p>
                    </div>

                    {!hasArrived ? (
                        <button
                            className="btn-primary"
                            style={{ width: '100%', marginBottom: '1rem', background: '#3b82f6' }}
                            onClick={handleArrival}
                        >
                            I Have Arrived At The Shop
                        </button>
                    ) : (
                        <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '8px', marginBottom: '1rem', fontWeight: 'bold' }}>
                            Kitchen has been notified of your arrival.
                        </div>
                    )}

                    <button className="btn-secondary" onClick={() => {
                        setPaymentSuccess(false);
                        setCollectionPin(null);
                        setCustomerName('');
                        setCustomerPhone('');
                        setModifiers('');
                        setCollectionTime('');
                        setDeliveryAddress('');
                        setHasArrived(false);
                    }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h2 className="page-title" style={{ marginBottom: '0.5rem' }}>{vendorName || branding?.name || 'Menu'}</h2>
                        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Choose multiple items, keep your cart, and checkout when you are ready.</p>
                    </div>
                    {onBack && (
                        <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '0.85rem 1.1rem' }} onClick={onBack}>
                            Back to Home
                        </button>
                    )}
                </div>

                {cart.length > 0 && (
                    <div style={{
                        color: '#94a3b8',
                        fontSize: '0.92rem',
                        textAlign: 'center',
                    }}>
                        Your cart is saved on this device. Use the cart button in the top-right corner when you are ready to check out.
                    </div>
                )}

                {!buyerPaymentsAvailable && (
                    <div style={{
                        padding: '0.9rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.28)',
                        color: '#fecaca',
                        fontWeight: '600',
                        textAlign: 'center',
                    }}>
                        Checkout is temporarily unavailable right now.
                    </div>
                )}
            </div>

            <div className="menu-grid">
                {menuItems.map((item) => {
                    const inCart = cart.find((entry) => entry.id === item.id);
                    return (
                        <div key={item.id} className="menu-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div
                                style={{
                                    height: '180px',
                                    background: item.image_url ? `url(${item.image_url}) center/cover` : '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#94a3b8',
                                }}
                            >
                                {!item.image_url && <span style={{ fontSize: '2rem' }}></span>}
                            </div>

                            <div className="menu-card-content" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                                <div>
                                    <h3 className="item-name" style={{ margin: '0 0 0.35rem 0' }}>{item.name}</h3>
                                    {item.description && (
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{item.description}</p>
                                    )}
                                    <p className="item-price" style={{ margin: 0 }}>R {Number(item.price).toFixed(2)}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    {inCart ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                            <button type="button" className="btn-secondary" style={{ width: '48px', padding: '0.75rem' }} onClick={() => changeQty(item.id, inCart.qty - 1)}>
                                                -
                                            </button>
                                            <div style={{ minWidth: '44px', textAlign: 'center', fontWeight: '700', color: '#fff' }}>{inCart.qty}</div>
                                            <button type="button" className="btn-secondary" style={{ width: '48px', padding: '0.75rem' }} onClick={() => changeQty(item.id, inCart.qty + 1)}>
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <button className="btn-primary" onClick={() => addToCart(item)} style={{ width: '100%' }}>
                                            Add to Cart
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isCheckoutOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Complete Your Order</h3>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            {cart.map((item) => (
                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontWeight: '700' }}>{item.name}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>R {Number(item.price).toFixed(2)} each</div>
                                    </div>
                                    <button type="button" className="btn-secondary" style={{ width: '40px', padding: '0.55rem' }} onClick={() => changeQty(item.id, item.qty - 1)}>-</button>
                                    <div style={{ minWidth: '20px', textAlign: 'center', fontWeight: '700' }}>{item.qty}</div>
                                    <button type="button" className="btn-secondary" style={{ width: '40px', padding: '0.55rem' }} onClick={() => changeQty(item.id, item.qty + 1)}>+</button>
                                </div>
                            ))}
                            <div style={{ borderTop: '1px solid #334155', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'grid', gap: '0.35rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Subtotal</span>
                                    <span>R {cartSubtotal.toFixed(2)}</span>
                                </div>
                                {fulfillmentMethod === 'delivery' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Delivery Fee</span>
                                        <span>R {deliveryFee.toFixed(2)}</span>
                                    </div>
                                )}
                                <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                    <span>Total</span>
                                    <span>R {grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleBuyNow} className="checkout-form">
                            {deliveryLocations.length > 0 && (
                                <div className="form-group">
                                    <label>How would you like to receive your order?</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <button
                                            type="button"
                                            className={fulfillmentMethod === 'collection' ? 'btn-primary' : 'btn-secondary'}
                                            onClick={() => setFulfillmentMethod('collection')}
                                        >
                                            Collect
                                        </button>
                                        <button
                                            type="button"
                                            className={fulfillmentMethod === 'delivery' ? 'btn-primary' : 'btn-secondary'}
                                            onClick={() => setFulfillmentMethod('delivery')}
                                        >
                                            Delivery
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>{fulfillmentMethod === 'delivery' ? 'Delivery Branch' : 'Collection Location'}</label>
                                <select
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value)}
                                    required
                                    className="form-input"
                                >
                                    <option value="" disabled>Select location...</option>
                                    {selectableLocations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name}{fulfillmentMethod === 'delivery' && Number(loc.delivery_fee || 0) > 0 ? ` (Delivery R ${Number(loc.delivery_fee).toFixed(2)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {fulfillmentMethod === 'delivery' && (
                                <div className="form-group">
                                    <label>Delivery Address</label>
                                    <textarea
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                        required
                                        placeholder="House number, street, area, and any landmark."
                                        className="form-input"
                                        style={{ minHeight: '110px', resize: 'vertical' }}
                                    />
                                </div>
                            )}

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
                                <label>WhatsApp Number</label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 0812345678"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    required
                                    className="form-input"
                                />
                                <small style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                                    Enter a valid 10-digit South African number so the business can confirm your order.
                                </small>
                            </div>

                            {fulfillmentMethod === 'collection' && (
                                <div className="form-group">
                                    <label>Estimated Collection Time (Optional)</label>
                                    <input
                                        type="time"
                                        value={collectionTime}
                                        onChange={(e) => setCollectionTime(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label>Special Instructions For This Order (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Please put atchaar on the side"
                                    value={modifiers}
                                    onChange={(e) => setModifiers(e.target.value)}
                                    className="form-input"
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={cancelCheckout} disabled={processingId !== null}>
                                    Back to Menu
                                </button>
                                <button type="submit" className="btn-primary" disabled={processingId !== null || !buyerPaymentsAvailable}>
                                    {processingId !== null ? 'Processing...' : buyerPaymentsAvailable ? `Pay R ${grandTotal.toFixed(2)}` : 'Out of service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
