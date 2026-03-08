# WhatsApp Chatbot Integration Plan (Phase 4.5)

To fully solve Chef Dips' problems with customers ordering via WhatsApp and bypassing the queue or using fake POPs (Proof of Payment), the next step is connecting a WhatsApp Bot (e.g., via Twilio or Meta Graph API).

## 1. The Core Flow
Instead of taking manual orders over texts, Chef Dips will set up an auto-responder or a lightweight bot.

**User:** "Hi, I'd like to order a Kota."
**Bot:** "Hello! Welcome to Ko Chef Dips. To ensure your order is prepared immediately without delays, please place and pay for it securely using our online system here: `https://kotaguard.dips.com`\n\nOnce paid, you will instantly receive your official Order Number and skip the queue!"

## 2. Advanced Bot Flow (Future Scale)
If you want to keep customers entirely inside WhatsApp:

1. **Menu Display:** Bot sends an interactive WhatsApp List Message with Menu Items.
2. **Selection:** User taps "Beef Kota (R120)".
3. **Location:** Bot asks for location, user taps "Seshego".
4. **Checkout Link Generation:** The bot hits your API backend (Supabase Edge Function), which generates a unique **Paystack Payment Link** for exactly R120 and ties it to a `pending` order in Supabase.
5. **Payment Delivery:** Bot replies: "Great! Pay securely here: `[Paystack URL]`."
6. **Webhook Fulfillment:** The user pays on Paystack. The exact same webhook we built in Phase 1 (`verify-paystack`) triggers, marks the order as `paid`, and pushes it to the KDS dashboard (Dashboard goes "Ding!").
7. **Bot Confirmation:** A second webhook triggers the WhatsApp bot to send the final message: "Payment received! Your order number is #1234. We are preparing it now."

## 3. Recommended Tools
- **Meta WhatsApp Business Cloud API:** The most direct and affordable way to build this.
- **Supabase Edge Functions:** Ideal for hosting the webhook handlers that listen to both Paystack and Meta.

## 4. Next Steps
- Register a Meta Developer Account for WhatsApp Cloud API.
- Create a new Edge Function `whatsapp-bot` to handle incoming messages.
- Ensure the production URL is ready to be shared in the auto-responder immediately as a V1 solution.
