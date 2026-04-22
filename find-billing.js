const fs = require('fs');
const file = './components/AdminDashboard_modern.jsx';
let c = fs.readFileSync(file, 'utf8');

// Find starting point - the billing plan grid div
const startMarker = `                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>`;
const startIdx = c.indexOf(startMarker);
if (startIdx === -1) { console.error('Start marker not found'); process.exit(1); }

// Find ending point - right after the closing of the history section
// The section ends with: )}
//                         </div>
//                     </div>
// which is the end of the billing modal inner div
const endMarker = `                                    ))}\r\n                                </div>\r\n                            </div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            )}`;
const endIdx = c.indexOf(endMarker, startIdx);
if (endIdx === -1) {
    // Fallback: try to find by content
    const alt = `</div>\r\n                    </div>\r\n                </div>\r\n            )}`;
    const altIdx = c.indexOf(alt, startIdx);
    console.log('Alt end idx:', altIdx);
    console.log('Nearby content:', JSON.stringify(c.slice(startIdx + startMarker.length, startIdx + startMarker.length + 1000)));
    process.exit(1);
}

const oldContent = c.slice(startIdx, endIdx + endMarker.length);
console.log('Old content length:', oldContent.length);

const newContent = `                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
                            <div style={{ background: 'rgba(51, 65, 85, 0.3)', padding: '2rem', borderRadius: '20px', border: \`1px solid \${vendorConfig?.subscription_status === 'active' ? 'rgba(0,230,118,0.3)' : '#334155'}\` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', textTransform: 'uppercase' }}>Current Plan</h3>
                                    <span style={{ background: vendorConfig?.subscription_status === 'active' ? '#00e676' : vendorConfig?.subscription_status === 'trial' ? '#fbbf24' : '#ef4444', color: '#0f172a', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{vendorConfig?.subscription_status || 'trial'}</span>
                                </div>
                                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', marginBottom: '0.5rem' }}>R 399 <span style={{ fontSize: '1rem', color: '#64748b' }}>/ month</span></div>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Unlimited orders, real-time KDS, AI Manager, multi-branch management, and WhatsApp notifications.</p>
                                {vendorConfig?.next_billing_date && vendorConfig?.subscription_status === 'active' && (
                                    <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '1rem' }}>Next billing: <strong style={{ color: '#94a3b8' }}>{new Date(vendorConfig.next_billing_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
                                )}
                                {vendorConfig?.subscription_status !== 'active' && (
                                    <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#fcd34d' }}>
                                        {(() => { const { daysLeft } = getTrialInfo(); return daysLeft > 0 ? \`⏳ \${daysLeft} day\${daysLeft !== 1 ? 's' : ''} remaining in your free trial.\` : '⚠️ Trial expired. Subscribe to restore access.'; })()}
                                    </div>
                                )}
                                <button onClick={handleSubscribe} disabled={isInitiatingBilling} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: isInitiatingBilling ? '#334155' : 'linear-gradient(135deg, #00e676, #00c853)', border: 'none', borderRadius: '12px', color: '#0f172a', fontWeight: '900', cursor: isInitiatingBilling ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                                    {isInitiatingBilling ? 'Redirecting...' : vendorConfig?.subscription_status === 'active' ? '🔄 Renew / Manage Plan' : '🚀 Subscribe — R 399/month'}
                                </button>
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 1.5rem', fontSize: '1rem', color: '#fff' }}>Payment History</h3>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {vendorConfig?.last_billing_date ? (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{new Date(vendorConfig.last_billing_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' })}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Monthly Subscription</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.85rem' }}>R 399</div>
                                                <div style={{ fontSize: '0.7rem', color: '#00e676' }}>Paid</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <p style={{ color: '#475569', fontSize: '0.85rem', padding: '1rem' }}>No payment history yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}`.replace(/\n/g, '\r\n');

c = c.slice(0, startIdx) + newContent + c.slice(endIdx + endMarker.length);
fs.writeFileSync(file, c, 'utf8');
console.log('Billing modal updated!');
