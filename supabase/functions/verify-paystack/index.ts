import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(() => {
  return new Response(
    JSON.stringify({
      error: "verify-paystack is deprecated",
      message:
        "Use paystack-webhook for webhook processing and finalize-order-payment for client-side payment finalization.",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    }
  );
});
