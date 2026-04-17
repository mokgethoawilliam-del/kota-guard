const fs = require('fs');
const path = require('path');

const adminPath = 'components/AdminDashboard.jsx';
const cssPath = 'src/index.css';

console.log('--- ABSOLUTE ZERO v2: FINAL RESTORATION INITIATED ---');

// 1. HARDEN SUBSCRIPTION LOGIC & RESTORE FLOATING CHAT
if (fs.existsSync(adminPath)) {
    let content = fs.readFileSync(adminPath, 'utf8');

    // A. Fix Real-time Logic (Filtering)
    const subscriptionBlockRegex = /useEffect\(\(\) => \{[\s\S]*?\/\/ 1\. Subscribe to Realtime Updates[\s\S]*?return \(\) => \{[\s\S]*?\};[\s\S]*?\}, \[currentVendorId\]\);/;
    const hardenedSubscription = `useEffect(() => {
        if (!currentVendorId) return;
        fetchInitialData();

        // 1. Subscribe to Realtime Updates on the 'orders' table
        const channel = supabase
            .channel(\`orders:\${currentVendorId}\`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders', filter: \`vendor_id=eq.\${currentVendorId}\` },
                (payload) => {
                    const updatedOrder = payload.new;
                    setOrders(currentOrders => {
                        const existingOrder = currentOrders.find(o => o.id === updatedOrder.id);
                        
                        let shouldDing = false;
                        if (updatedOrder.status === 'paid' && (!existingOrder || existingOrder.status !== 'paid')) {
                            shouldDing = true;
                        }
                        if (updatedOrder.customer_arrived && existingOrder && !existingOrder.customer_arrived) {
                            shouldDing = true;
                            setArrivalAlert(updatedOrder);
                            setTimeout(() => setArrivalAlert(null), 10000); 
                        }

                        if (shouldDing) playDing();

                        if (existingOrder) {
                            if (updatedOrder.status === 'completed' || updatedOrder.status === 'refunded') {
                                setHistoryOrders(curr => [{ ...existingOrder, ...updatedOrder }, ...curr]);
                                return currentOrders.filter(o => o.id !== updatedOrder.id);
                            }
                            return currentOrders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
                        } else if (updatedOrder.status !== 'completed' && updatedOrder.status !== 'refunded') {
                            return [updatedOrder, ...currentOrders];
                        }
                        return currentOrders;
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders', filter: \`vendor_id=eq.\${currentVendorId}\` },
                (payload) => {
                    const newOrder = payload.new;
                    if (newOrder.status === 'paid') playDing();
                    setOrders(current => [newOrder, ...current]);
                }
            )
            .subscribe();

        // 2. Subscribe to Support Chats
        const chatChannel = supabase
            .channel(\`support_chats:\${currentVendorId}\`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'support_chats', filter: \`vendor_id=eq.\${currentVendorId}\` },
                (payload) => {
                    const newChat = payload.new;
                    setChats(current => [...current, newChat]);
                    if (newChat.sender_type === 'customer') playDing();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(chatChannel);
        };
    }, [currentVendorId]);`;
    
    content = content.replace(subscriptionBlockRegex, hardenedSubscription);

    // B. Re-inject Floating Support Chat Component (before the final closing brace of the component)
    const chatUI = `
            {/* FLOATING SUPPORT CHAT COMPONENT */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
                {activeChatSession ? (
                    <div className="chat-window-glass" style={{ width: '350px', height: '450px', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '8px', height: '8px', background: '#00e676', borderRadius: '50%' }}></div>
                                <span style={{ fontWeight: 'bold' }}>Customer Chat</span>
                            </div>
                            <button onClick={() => setActiveChatSession(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>x</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {chats.filter(c => c.customer_id === activeChatSession).map((chat, idx) => (
                                <div key={idx} style={{ 
                                    alignSelf: chat.sender_type === 'admin' ? 'flex-end' : 'flex-start',
                                    background: chat.sender_type === 'admin' ? '#1e293b' : '#334155',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '16px',
                                    maxWidth: '85%',
                                    fontSize: '0.9rem',
                                    color: '#fff',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}>
                                    {chat.message}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    type="text" 
                                    value={newAdminMessage}
                                    onChange={(e) => setNewAdminMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem', color: '#fff', outline: 'none' }}
                                    onKeyPress={(e) => { if(e.key === 'Enter') handleSendAdminMessage(); }}
                                />
                                <button onClick={handleSendAdminMessage} style={{ background: '#00e676', border: 'none', borderRadius: '12px', padding: '0.75rem', cursor: 'pointer', color: '#0f172a' }}>
                                    <Icons.Chat />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => {
                            const lastCust = [...chats].reverse().find(c => c.sender_type === 'customer');
                            if (lastCust) setActiveChatSession(lastCust.customer_id);
                        }}
                        style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#00e676', border: 'none', color: '#0f172a', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,230,118,0.4)', cursor: 'pointer' }}
                    >
                        <Icons.Chat />
                        {chats.filter(c => c.sender_type === 'customer').length > 0 && (
                            <div style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {Array.from(new Set(chats.filter(c => c.sender_type === 'customer').map(c => c.customer_id))).length}
                            </div>
                        )}
                    </button>
                )}
            </div>
    `;

    // Insert Chat UI before the final return closing tag
    if (!content.includes('chat-window-glass')) {
        content = content.replace(/<\/main>[\s\S]*?<\/div>[\s\S]*?\);[\s\S]*?\}/, `</main>\n${chatUI}\n        </div>\n    );\n}`);
    }

    // C. Fix handleSendAdminMessage (if missing or incorrect)
    const sendMsgFunc = `
    const handleSendAdminMessage = async () => {
        if (!newAdminMessage.trim() || !activeChatSession) return;
        try {
            const { error } = await supabase.from('support_chats').insert({
                vendor_id: currentVendorId,
                customer_id: activeChatSession,
                message: newAdminMessage,
                sender_type: 'admin'
            });
            if (error) throw error;
            setNewAdminMessage('');
        } catch (err) {
            console.error("Failed to send chat", err);
        }
    };
    `;
    if (!content.includes('handleSendAdminMessage')) {
        content = content.replace('const handleLogout = async () => {', sendMsgFunc + '\n    const handleLogout = async () => {');
    }

    fs.writeFileSync(adminPath, content, 'utf8');
    console.log('AdminDashboard.jsx: SUBSCRIPTIONS & CHAT RESTORED.');
}

// 2. CSS LAYOUT RESTORATION (Sidebar Fix)
if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, 'utf8');
    
    // Ensure .admin-shell is absolute flex row with sidebar
    const shellCss = `.admin-shell {
  display: flex !important;
  flex-direction: row !important;
  height: 100vh !important;
  width: 100vw !important;
  background-color: #0f172a !important;
  color: #f8fafc !important;
  overflow: hidden !important;
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
}`;

    if (!css.includes('.admin-shell {')) {
        css += '\n' + shellCss;
    } else {
        css = css.replace(/\.admin-shell \{[\s\S]*?\}/, shellCss);
    }
    
    // Glassmorphism Floating Chat
    const chatCss = `
.chat-window-glass {
  background: rgba(30, 41, 59, 0.7) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
  animation: slideUpChat 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUpChat {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}`;
    if (!css.includes('.chat-window-glass')) {
        css += '\n' + chatCss;
    }

    fs.writeFileSync(cssPath, css, 'utf8');
    console.log('index.css: SIDEBAR & CHAT LAYOUT RESTORED.');
}

console.log('--- ABSOLUTE ZERO v2: SUCCESS ---');
