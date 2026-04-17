import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LegalTerms() {
    const navigate = useNavigate();

    return (
        <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '3rem' }}>
                <button 
                    onClick={() => navigate(-1)} 
                    style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', marginBottom: '2rem', fontSize: '1rem' }}
                >
                    &larr; Go Back
                </button>

                <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#fff' }}>Terms of Service & Legal Disclaimer</h1>
                <p style={{ color: '#94a3b8', marginBottom: '3rem' }}>Last Updated: {new Date().toLocaleDateString()}</p>

                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ color: '#00e676', marginBottom: '1rem' }}>1. Introduction</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>
                        Welcome to VulaHub ("Company", "we", "our", "us"). We provide a Software-as-a-Service (SaaS) platform that allows independent food vendors and stalls ("Vendors") to manage their operations, menus, and receive online orders from their customers ("End-Users"). By accessing our platform as either a Vendor or an End-User, you agree to these Terms of Service.
                    </p>
                </section>

                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ color: '#00e676', marginBottom: '1rem' }}>2. Role of the Platform (Disclaimer of Liability)</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1', marginBottom: '1rem' }}>
                        <strong>IMPORTANT: VulaHub is strictly a technology provider.</strong> We do not prepare, handle, sell, or deliver food or beverages. We simply supply the digital infrastructure for Vendors to operate their independent businesses.
                    </p>
                    <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                        <li style={{ marginBottom: '0.5rem' }}>We are not a party to the transaction between the Vendor and the End-User.</li>
                        <li style={{ marginBottom: '0.5rem' }}>We hold no liability for the quality, safety, hygiene, or legality of any food products sold by Vendors using our platform.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Any disputes regarding missing items, food poisoning, refunds, or poor service must be resolved directly between the End-User and the Vendor. VulaHub accepts no responsibility or legal liability for these disputes.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ color: '#00e676', marginBottom: '1rem' }}>3. Payments and Decentralized Infrastructure</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>
                        Our platform operates a decentralized payment architecture. When an End-User purchases from a Vendor, the payment is securely processed directly into the Vendors own registered payment gateway accounts (e.g., Paystack). VulaHub does not hold, intercept, or directly manage consumer funds for food orders. Consequently, we cannot issue chargebacks or refunds on behalf of the Vendor.
                    </p>
                </section>

                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ color: '#00e676', marginBottom: '1rem' }}>4. Vendor Responsibilities</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>
                        By creating an account, Vendors agree to:
                    </p>
                    <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', color: '#cbd5e1', marginTop: '1rem' }}>
                        <li style={{ marginBottom: '0.5rem' }}>Maintain accurate and up-to-date business information, including valid health and safety certificates as required by their local municipality or government.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Fulfill orders promptly and manage their own customer service professionally through the provided Live Chat infrastructure.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Keep their API credentials (e.g., Paystack Secret Keys) secure. VulaHub is not liable for unauthorized access stemming from poorly managed Vendor credentials.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '2.5rem' }}>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>5. Account Termination & "Danger Zone"</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>
                        Vendors may permanently delete their accounts at any time via the Admin Dashboard. This action is irreversible and immediately wipes all menu data, order history, and integration keys from VulaHub's servers. We reserve the right to suspend or terminate any Vendor account that violates these Terms or engages in fraudulent activity, without prior notice.
                    </p>
                </section>

                <section>
                    <h2 style={{ color: '#00e676', marginBottom: '1rem' }}>6. General Prohibitions</h2>
                    <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>
                        You may not use the Service to: (a) engage in unlawful, fraudulent, or malicious activities; (b) distribute viruses or harmful code; (c) attempt to bypass the platform's security mechanisms.
                    </p>
                </section>
            </div>
        </div>
    );
}
