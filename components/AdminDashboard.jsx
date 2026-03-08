import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Audio context for the "Ding" sound alert
const playDing = () => {
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio autoplay blocked by browser:', e));
    } catch (err) {
        console.error("Failed to play sound", err);
    }
};

export default function AdminDashboard() {
    const [orders, setOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [activeTab, setActiveTab] = useState('kds'); // 'kds' | 'history' | 'finances' | 'inventory'

    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();

        // 1. Subscribe to Realtime Updates on the 'orders' table
        const channel = supabase
            .channel('public:orders')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    const updatedOrder = payload.new;

                    // If an order just shifted to 'paid' status (verified by Webhook)
                    if (updatedOrder.status === 'paid') {
                        playDing(); // Sound Alert!
                        setOrders(currentOrders => {
                            // Replace if exists, or add to front if new to dashboard
                            const exists = currentOrders.find(o => o.id === updatedOrder.id);
                            if (exists) {
                                return currentOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
                            }
                            return [updatedOrder, ...currentOrders];
                        });
                    } else {
                        // General status updates (preparing, ready, etc)
                        setOrders(currentOrders => currentOrders.map(o =>
                            o.id === updatedOrder.id ? updatedOrder : o
                        ));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    const newOrder = payload.new;
                    if (newOrder.status === 'paid') playDing();
                    if (newOrder.status !== 'completed' && newOrder.status !== 'refunded') {
                        setOrders(current => [newOrder, ...current]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchInitialData() {
        try {
            setLoading(true);

            // Get valid locations
            const { data: locData } = await supabase.from('locations').select('*');
            if (locData) setLocations(locData);

            // Get all non-pending orders (Paid, Preparing, Ready, Completed)
            const { data: orderData, error: orderErr } = await supabase
                .from('orders')
                .select(`
                    *,
                    locations (name),
                    order_items (
                        quantity,
                        modifiers_json,
                        menu_items (name)
                    )
                `)
                .neq('status', 'pending') // Hide pending/abandoned checkouts
                .order('created_at', { ascending: false });

            if (orderErr) throw orderErr;

            const active = orderData?.filter(o => o.status !== 'completed' && o.status !== 'refunded') || [];
            const history = orderData?.filter(o => o.status === 'completed' || o.status === 'refunded') || [];

            setOrders(active);
            setHistoryOrders(history);

            // Fetch Expenses
            const { data: expData, error: expErr } = await supabase
                .from('expenses')
                .select('*')
                .order('created_at', { ascending: false });

            if (!expErr && expData) {
                setExpenses(expData);
            }

            // Fetch Ingredients
            const { data: ingData, error: ingErr } = await supabase
                .from('ingredients')
                .select('*')
                .order('name');

            if (!ingErr && ingData) {
                setIngredients(ingData);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err.message);
        } finally {
            setLoading(false);
        }
    }

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            // Optimistic UI update
            setOrders(current => current.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) {
                // Revert on failure
                fetchInitialData();
                throw error;
            }
        } catch (err) {
            console.error("Failed to update status", err);
            alert("Could not update order status.");
        }
    };

    // Phase 4: Business Intelligence - Basic CSV Export (Active Queue)
    const exportToCSV = () => {
        if (orders.length === 0) {
            alert("No data to export right now.");
            return;
        }

        const headers = ['Order Number', 'Date', 'Status', 'Customer', 'WhatsApp', 'Total (ZAR)'];
        const rows = orders.map(o => [
            o.order_number,
            new Date(o.created_at).toLocaleString(),
            o.status,
            o.customer_name,
            o.customer_phone,
            o.total_price
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `kotaguard_active_queue_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Phase 7: History Vault PDF Export
    const exportPDF = () => {
        if (historyOrders.length === 0) return alert("No history to export.");

        const doc = new jsPDF();
        doc.text("Kota Guard - Sales History Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

        const tableColumn = ["Order #", "Date", "Customer", "Location", "Items", "Total"];
        const tableRows = [];

        historyOrders.forEach(order => {
            const locName = order.locations?.name || 'Unknown';
            const itemsStr = order.order_items?.map(i => `${i.quantity}x ${i.menu_items?.name}`).join(', ') || '';
            const rowData = [
                order.order_number,
                new Date(order.created_at).toLocaleDateString(),
                order.customer_name,
                locName,
                itemsStr,
                `R ${order.total_price}`
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
        });

        const totalRev = historyOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
        doc.text(`Total Historical Revenue: R ${totalRev}`, 14, doc.lastAutoTable.finalY + 10);

        doc.save(`kota_sales_report_${new Date().getTime()}.pdf`);
    };

    // Phase 8: Add Expense with Receipt Upload
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', receiptFile: null });
    const [uploadingReceipt, setUploadingReceipt] = useState(false);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            setUploadingReceipt(true);
            let receipt_url = null;

            // 1. Upload receipt to Supabase Storage if file exists
            if (newExpense.receiptFile) {
                const fileExt = newExpense.receiptFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `receipts/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('business-documents')
                    .upload(filePath, newExpense.receiptFile);

                if (uploadError) {
                    console.error("Upload error (Bucket 'business-documents' might be missing):", uploadError);
                    alert("Could not upload receipt image. Ensure the Storage bucket 'business-documents' exists and is public.");
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('business-documents')
                        .getPublicUrl(filePath);
                    receipt_url = publicUrl;
                }
            }

            // 2. Insert expense record
            const { data, error } = await supabase
                .from('expenses')
                .insert({
                    description: newExpense.description,
                    amount: parseFloat(newExpense.amount),
                    receipt_url: receipt_url
                })
                .select()
                .single();

            if (error) throw error;

            setExpenses([data, ...expenses]);
            setNewExpense({ description: '', amount: '', receiptFile: null });

            // Clear file input manually
            const fileInput = document.getElementById('receipt-upload');
            if (fileInput) fileInput.value = '';

        } catch (err) {
            console.error(err);
            alert("Could not add expense. Make sure the expenses table exists in Supabase.");
        } finally {
            setUploadingReceipt(false);
        }
    };

    // Phase 9: Add / Delete Ingredients
    const [newIngredient, setNewIngredient] = useState({ name: '', unit: '', current_stock: '', low_stock_threshold: '' });
    const [isAddingIngredient, setIsAddingIngredient] = useState(false);

    const handleAddIngredient = async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('ingredients')
                .insert({
                    name: newIngredient.name,
                    unit: newIngredient.unit,
                    current_stock: parseFloat(newIngredient.current_stock || 0),
                    low_stock_threshold: parseFloat(newIngredient.low_stock_threshold || 10)
                })
                .select()
                .single();

            if (error) throw error;

            setIngredients([...ingredients, data].sort((a, b) => a.name.localeCompare(b.name)));
            setNewIngredient({ name: '', unit: '', current_stock: '', low_stock_threshold: '' });
            setIsAddingIngredient(false);
        } catch (err) {
            console.error(err);
            alert("Could not add ingredient.");
        }
    };

    const handleDeleteIngredient = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This might break recipe deductions.`)) return;

        try {
            const { error } = await supabase.from('ingredients').delete().eq('id', id);
            if (error) throw error;
            setIngredients(ingredients.filter(ing => ing.id !== id));
        } catch (err) {
            console.error(err);
            alert("Could not delete ingredient.");
        }
    };

    // Financial Calculations
    // Include all paid, preparing, ready, and completed orders as revenue
    const totalRevenue = [...orders, ...historyOrders].reduce((sum, o) => {
        if (o.status !== 'refunded' && o.status !== 'pending') {
            return sum + Number(o.total_price || 0);
        }
        return sum;
    }, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const filteredOrders = selectedLocation === 'all'
        ? orders
        : orders.filter(o => o.location_id === selectedLocation);

    // Grouping for the Kanban/KFC display
    const newOrders = filteredOrders.filter(o => o.status === 'paid');
    const prepOrders = filteredOrders.filter(o => o.status === 'preparing');
    const readyOrders = filteredOrders.filter(o => o.status === 'ready');

    const OrderCard = ({ order }) => (
        <div className="kds-card">
            <div className="kds-card-header">
                <h3>{order.order_number}</h3>
                <span className={`status-badge status-${order.status}`}>{order.status}</span>
            </div>
            <div className="kds-customer-info">
                <p><strong>{order.customer_name}</strong></p>
                <p>WA: {order.customer_phone}</p>
                {selectedLocation === 'all' && <p className="kds-loc">📍 {order.locations?.name}</p>}

                {/* PRE-ORDER TIME AND ARRIVAL FLAG */}
                {order.estimated_collection_time && (
                    <p style={{ color: '#fbbf24', fontWeight: 'bold', marginTop: '0.25rem' }}>
                        ⏰ Collect time: {order.estimated_collection_time.substring(0, 5)}
                    </p>
                )}
                {order.customer_arrived && (
                    <div style={{ background: '#ef4444', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.25rem', fontWeight: 'bold', fontSize: '0.8rem', animation: 'pulse 2s infinite' }}>
                        📍 CUSTOMER ARRIVED
                    </div>
                )}
            </div>

            <div className="kds-items">
                {order.order_items && order.order_items.map((item, idx) => (
                    <div key={idx} className="kds-item-row">
                        <span className="qty">{item.quantity}x</span>
                        <div className="item-details">
                            <span className="name">{item.menu_items?.name}</span>
                            {item.modifiers_json?.custom_notes && (
                                <span className="modifier">Note: {item.modifiers_json.custom_notes}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="kds-actions">
                {order.status === 'paid' && (
                    <button className="btn-kds btn-prep" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                        Start Preparing
                    </button>
                )}
                {order.status === 'preparing' && (
                    <button className="btn-kds btn-ready" onClick={() => updateOrderStatus(order.id, 'ready')}>
                        Mark Ready
                    </button>
                )}
                {order.status === 'ready' && (
                    <button className="btn-kds btn-complete" onClick={() => updateOrderStatus(order.id, 'completed')}>
                        Collected / Done
                    </button>
                )}
            </div>
        </div>
    );

    if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

    return (
        <div className="kds-container">
            <header className="kds-header">
                <div className="kds-brand">Kota Guard <span>KDS</span></div>

                <div className="kds-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'kds' ? 'active' : ''}`}
                        onClick={() => setActiveTab('kds')}
                    >🔥 Live Kitchen</button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >🗄️ History Vault</button>
                    <button
                        className={`tab-btn ${activeTab === 'finances' ? 'active' : ''}`}
                        onClick={() => setActiveTab('finances')}
                    >💰 Finances</button>
                    <button
                        className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inventory')}
                    >📦 Inventory</button>
                </div>

                <div className="kds-controls">
                    <label>Location Filter:</label>
                    <select
                        className="kds-select"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                    >
                        <option value="all">All Locations</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            {activeTab === 'kds' && (
                <div className="kds-columns">
                    {/* Column 1: New / Paid */}
                    <div className="kds-col kds-col-new">
                        <h2>📥 NEW ORDERS ({newOrders.length})</h2>
                        <div className="kds-list">
                            {newOrders.map(o => <OrderCard key={o.id} order={o} />)}
                            {newOrders.length === 0 && <p className="empty-state">No new orders.</p>}
                        </div>
                    </div>

                    {/* Column 2: Preparing */}
                    <div className="kds-col kds-col-prep">
                        <h2>🍳 PREPARING ({prepOrders.length})</h2>
                        <div className="kds-list">
                            {prepOrders.map(o => <OrderCard key={o.id} order={o} />)}
                            {prepOrders.length === 0 && <p className="empty-state">Kitchen is clear.</p>}
                        </div>
                    </div>

                    {/* Column 3: Ready */}
                    <div className="kds-col kds-col-ready">
                        <h2>🛍️ READY FOR COLLECTION ({readyOrders.length})</h2>
                        <div className="kds-list">
                            {readyOrders.map(o => <OrderCard key={o.id} order={o} />)}
                            {readyOrders.length === 0 && <p className="empty-state">No orders awaiting pickup.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="vault-container">
                    <div className="vault-header">
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Completed Order History</h2>
                            <p style={{ color: '#94a3b8' }}>All collected and closed orders appear here.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={exportToCSV}>📊 Active Queue CSV</button>
                            <button className="btn-primary" onClick={exportPDF}>📄 Download PDF Report</button>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="vault-table">
                            <thead>
                                <tr>
                                    <th>Order Number</th>
                                    <th>Date Completed</th>
                                    <th>Customer</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyOrders.map(o => (
                                    <tr key={o.id}>
                                        <td><strong>{o.order_number}</strong></td>
                                        <td>{new Date(o.updated_at || o.created_at).toLocaleString()}</td>
                                        <td>
                                            {o.customer_name} ({o.customer_phone})<br />
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📍 {o.locations?.name || 'Local'}</span>
                                        </td>
                                        <td>
                                            {o.order_items?.map(i => `${i.quantity}x ${i.menu_items?.name}`).join(', ')}
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: '#00e676' }}>R {o.total_price}</td>
                                    </tr>
                                ))}
                                {historyOrders.length === 0 && (
                                    <tr><td colSpan="5" className="empty-state">No historical orders found. Make some sales!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'finances' && (
                <div className="vault-container">
                    <div className="vault-header" style={{ marginBottom: '1rem', paddingBottom: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Financial Ledger & Net Profit</h2>
                            <p style={{ color: '#94a3b8' }}>Real-time revenue tracking versus logged expenses.</p>
                        </div>
                    </div>

                    {/* Financial Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="kds-card" style={{ borderLeftColor: '#34d399', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Total Gross Revenue</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>R {totalRevenue.toFixed(2)}</div>
                        </div>
                        <div className="kds-card" style={{ borderLeftColor: '#f43f5e', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Total Expenses</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fb7185' }}>R {totalExpenses.toFixed(2)}</div>
                        </div>
                        <div className="kds-card" style={{ borderLeftColor: netProfit >= 0 ? '#3b82f6' : '#f43f5e', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Net Profit</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: netProfit >= 0 ? '#60a5fa' : '#fb7185' }}>
                                R {netProfit.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Expense Form & List */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                        <div className="kds-card" style={{ padding: '1.5rem', height: 'max-content' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>⚡ Quick Add Expense</h3>
                            <form className="checkout-form" onSubmit={handleAddExpense}>
                                <div className="form-group">
                                    <label>Expense Description</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        placeholder="e.g. Bought 2L Oil"
                                        value={newExpense.description}
                                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Amount (ZAR)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="0.01"
                                        className="form-input"
                                        placeholder="e.g. 150"
                                        value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Receipt Photo (Optional)</label>
                                    <input
                                        type="file"
                                        id="receipt-upload"
                                        accept="image/*,application/pdf"
                                        className="form-input"
                                        onChange={(e) => setNewExpense({ ...newExpense, receiptFile: e.target.files[0] })}
                                    />
                                </div>
                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }} disabled={uploadingReceipt}>
                                    {uploadingReceipt ? 'Uploading...' : 'Log Expense'}
                                </button>
                            </form>
                        </div>

                        <div className="table-responsive">
                            <table className="vault-table">
                                <thead>
                                    <tr>
                                        <th>Date Logged</th>
                                        <th>Description</th>
                                        <th>Receipt</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(e => (
                                        <tr key={e.id}>
                                            <td>{new Date(e.created_at).toLocaleDateString()}</td>
                                            <td>{e.description}</td>
                                            <td>
                                                {e.receipt_url
                                                    ? <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>View Receipt</a>
                                                    : <span style={{ color: '#64748b' }}>-</span>
                                                }
                                            </td>
                                            <td style={{ color: '#fca5a5', fontWeight: 'bold' }}>- R {e.amount}</td>
                                        </tr>
                                    ))}
                                    {expenses.length === 0 && (
                                        <tr><td colSpan="4" className="empty-state">No expenses logged yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="vault-container">
                    <div className="vault-header">
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Live Ingredient Inventory</h2>
                            <p style={{ color: '#94a3b8' }}>Manage raw ingredients. Stock automatically deducts when Kitchen Staff click "Start Preparing".</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={fetchInitialData}>🔄 Refresh</button>
                            <button className="btn-primary" onClick={() => setIsAddingIngredient(!isAddingIngredient)}>
                                {isAddingIngredient ? 'Cancel' : '➕ Add Ingredient'}
                            </button>
                        </div>
                    </div>

                    {isAddingIngredient && (
                        <div className="kds-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>Add New Ingredient</h3>
                            <form className="checkout-form" onSubmit={handleAddIngredient} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Ingredient Name</label>
                                    <input type="text" required className="form-input" placeholder="e.g. Eggs" value={newIngredient.name} onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Unit Metric</label>
                                    <input type="text" required className="form-input" placeholder="e.g. units, kg, lit" value={newIngredient.unit} onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Starting Stock</label>
                                    <input type="number" required className="form-input" placeholder="0" value={newIngredient.current_stock} onChange={(e) => setNewIngredient({ ...newIngredient, current_stock: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Low Stock Alert At</label>
                                    <input type="number" required className="form-input" placeholder="10" value={newIngredient.low_stock_threshold} onChange={(e) => setNewIngredient({ ...newIngredient, low_stock_threshold: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="submit" className="btn-primary" style={{ height: '48px', width: '100%' }}>Save Ingredient</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="table-responsive">
                        <table className="vault-table">
                            <thead>
                                <tr>
                                    <th>Ingredient</th>
                                    <th>Unit Metric</th>
                                    <th>Current Stock Level</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingredients.map(ing => {
                                    const isLow = Number(ing.current_stock) <= Number(ing.low_stock_threshold);
                                    return (
                                        <tr key={ing.id} style={{ borderLeft: isLow ? '4px solid #ef4444' : '4px solid transparent' }}>
                                            <td><strong>{ing.name}</strong></td>
                                            <td>{ing.unit}</td>
                                            <td style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{ing.current_stock}</td>
                                            <td>
                                                {isLow
                                                    ? <span className="status-badge status-paid">Low Stock</span>
                                                    : <span className="status-badge status-ready">Optimal</span>
                                                }
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-kds btn-paid"
                                                    style={{ background: '#ef4444', color: '#fff', marginLeft: '0.5rem' }}
                                                    onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {ingredients.length === 0 && (
                                    <tr><td colSpan="5" className="empty-state">No inventory ingredients found. Make sure mapping is complete.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
