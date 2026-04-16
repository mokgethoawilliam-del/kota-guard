import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';

export default function CustomerDashboard({ vendorId, onBack, branding = {} }) {
    const [phoneOrId, setPhoneOrId] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Chat State
    const [activeChatSession, setActiveChatSession] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    
    // Subscribe to chat session if active
    useEffect(() => {
        if (!activeChatSession) return;
        
        // Fetch historical
        supabase.from('kg_support_chats').select('*')
            .eq('session_identifier', activeChatSession)
            .order('created_at', { ascending: true })
            .then(({data, error}) => {
                if(data) setChatMessages(data);
            });

        // Listen for new ones
        const chatSub = supabase.channel(`chat_${activeChatSession}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'kg_support_chats',
                filter: `session_identifier=eq.${activeChatSession}`
            }, (payload) => {
                setChatMessages(current => [...current, payload.new]);
            })
            .subscribe();

        return () => supabase.removeChannel(chatSub);
    }, [activeChatSession]);

    // Track active orders for realtime updates
    useEffect(() => {
        if (orders.length === 0) return;

        // Listen for updates ONLY to the orders we are currently viewing
        const orderIds = orders.map(o => o.id);

        const subscription = supabase
            .channel('customer-tracker')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'kg_orders'
            }, (payload) => {
                const updatedOrder = payload.new;
                if (orderIds.includes(updatedOrder.id)) {
                    setOrders(current => current.map(o =>
                        o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o
                    ));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [orders]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!phoneOrId) return;

        try {
            setLoading(true);
            setSearched(true);
            let cleanedPhone = phoneOrId.replace(/\s+/g, '');

            // The user could type an Order number (e.g. ko/0308/001) or a phone number.
            // Let's search broadly across both matching fields
            let query = supabase
                .from('kg_orders')
                .select(`
                    *,
                    locations ( name ),
                    order_items (
                        quantity,
                        menu_items ( name )
                    )
                `)
                .eq('vendor_id', vendorId) // Filter by vendor
                .order('created_at', { ascending: false });

            // If it looks like an order number (contains a slash or is longer than standard phone)
            if (cleanedPhone.includes('/') || cleanedPhone.includes('-')) {
                query = query.ilike('order_number', `%${cleanedPhone}%`);
            } else {
                query = query.eq('customer_phone', cleanedPhone);
            }

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data || []);

        } catch (err) {
            console.error(err);
            alert("Could not fetch orders. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getStatusDisplay = (status, arrived) => {
        if (status === 'paid' || status === 'new') return { text: 'Order Sent to Kitchen', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' };
        if (status === 'preparing') return { text: 'Chef is Preparing', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' };
        if (status === 'ready' && !arrived) return { text: 'Ready for Collection!', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' };
        if (status === 'ready' && arrived) return { text: 'Handing it over soon...', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' };
        if (status === 'completed') return { text: 'Completed', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.2)' };
        if (status === 'refunded') return { text: 'Refunded / Cancelled', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
        return { text: 'Verifying...', color: '#64748b', bg: 'rgba(100, 116, 139, 0.2)' };
    };

    return (
        <div className="app-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <button className="btn-secondary" onClick={onBack} style={{ marginBottom: '2rem' }}>
                &larr; Back to Home
            </button>

            <h2 className="page-title" style={{ textAlign: 'left', marginBottom: '1rem' }}>Track Your Order</h2>
            <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
                Enter your WhatsApp number or your specific Order Number to see real-time status and your Kota history.
            </p>

            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Enter WhatsApp No. or Order Number..."
                    value={phoneOrId}
                    onChange={(e) => setPhoneOrId(e.target.value)}
                    required
                    style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Searching...' : 'Track'}
                </button>
            </form>

            <div className="orders-timeline">
                {searched && orders.length === 0 && (
                    <div className="empty-state" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔍</span>
                        No orders found for that number.
                    </div>
                )}

                {orders.map(order => {
                    const statusUI = getStatusDisplay(order.status, order.customer_arrived);
                    const isCompleted = order.status === 'completed' || order.status === 'refunded';

                    return (
                        <div key={order.id} style={{
                            background: isCompleted ? 'rgba(15, 23, 42, 0.5)' : 'rgba(30, 41, 59, 0.9)',
                            border: `1px solid ${isCompleted ? '#334155' : statusUI.color}`,
                            borderRadius: '12px',
                            padding: '1.5rem',
                            marginBottom: '1.5rem',
                            position: 'relative',
                            opacity: isCompleted ? 0.7 : 1
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem' }}>{order.order_number}</h3>
                                    <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                                        {new Date(order.created_at).toLocaleString()} • {order.locations?.name || 'Online'}
                                    </p>
                                </div>
                                <div style={{
                                    background: statusUI.bg,
                                    color: statusUI.color,
                                    padding: '0.5rem 1rem',
                                    borderRadius: '999px',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    border: `1px solid ${statusUI.color}40`,
                                    animation: (!isCompleted && order.status !== 'ready') ? 'pulse 2s infinite' : 'none'
                                }}>
                                    {statusUI.text}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                {order.order_items && order.order_items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <span style={{ color: '#00e676', fontWeight: 'bold' }}>{item.quantity}x</span>
                                        <span>{item.menu_items?.name}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>
                                    R {order.total_price}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {order.status !== 'completed' && order.status !== 'refunded' && !order.customer_arrived && (
                                        <button
                                            className="btn-primary"
                                            style={{ background: '#3b82f6', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                            onClick={async () => {
                                                const { error } = await supabase.from('kg_orders').update({ customer_arrived: true }).eq('id', order.id);
                                                if (!error) {
                                                    setOrders(current => current.map(o => o.id === order.id ? { ...o, customer_arrived: true } : o));
                                                    alert("Kitchen Notified!");
                                                }
                                            }}
                                        >
                                            📍 Notify Arrival
                                        </button>
                                    )}
                                    <button
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => setActiveChatSession(order.order_number)}
                                    >
                                        💬 Live Chat Support
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Native Support Chat Overlay */}
            {activeChatSession && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '350px',
                    height: '500px',
                    backgroundColor: '#1e293b',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid #334155',
                    zIndex: 1000
                }}>
                    <div style={{ padding: '1rem', background: '#0f172a', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>Support Chat</h3>
                            <p style={{ margin: 0, color: '#00e676', fontSize: '0.8rem' }}>Order: {activeChatSession}</p>
                        </div>
                        <button onClick={() => setActiveChatSession(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }}>&times;</button>
                    </div>

                    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#0f172a' }}>
                        {chatMessages.length === 0 && (
                            <p style={{ color: '#64748b', textAlign: 'center', fontSize: '0.9rem', marginTop: '2rem' }}>
                                Say hi! An admin will respond here shortly.
                            </p>
                        )}
                        {chatMessages.map(msg => {
                            const isCustomer = msg.sender_type === 'customer';
                            return (
                                <div key={msg.id} style={{
                                    alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                                    background: isCustomer ? '#00e676' : '#334155',
                                    color: isCustomer ? '#000' : '#fff',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '12px',
                                    borderBottomRightRadius: isCustomer ? '0' : '12px',
                                    borderBottomLeftRadius: !isCustomer ? '0' : '12px',
                                    maxWidth: '80%'
                                }}>
                                    <div style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{msg.message}</div>
                                    <div style={{ fontSize: '0.65rem', color: isCustomer ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', marginTop: '0.25rem', textAlign: isCustomer ? 'right' : 'left' }}>
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newMessage.trim()) return;
                        const { error } = await supabase.from('kg_support_chats').insert({
                            vendor_id: vendorId,
                            session_identifier: activeChatSession,
                            sender_type: 'customer',
                            message: newMessage.trim()
                        });
                        if (!error) setNewMessage('');
                    }} style={{ padding: '0.75rem', background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', gap: '0.5rem' }}>
                        <input 
                            type="text" 
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none' }}
                        />
                        <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            ➤
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
