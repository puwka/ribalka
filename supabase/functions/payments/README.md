# Payment Edge Functions (secrets server-side only)

## create-yookassa-payment
Env (Supabase secrets, never VITE_*):
- YOOKASSA_SHOP_ID
- YOOKASSA_SECRET_KEY
- PAYMENT_RETURN_URL

Flow:
1. Client creates local/DB payment `pending` via paymentService
2. Client calls this function with paymentId + amount
3. Function creates YooKassa payment, returns confirmation_url
4. Webhook `payment.succeeded` → paymentService.handleProviderWebhook

## create-robokassa-payment
Env:
- ROBOKASSA_MERCHANT_LOGIN
- ROBOKASSA_PASSWORD1
- ROBOKASSA_PASSWORD2
- ROBOKASSA_IS_TEST

Signature is computed only here. ResultURL → webhook handler.

## payment-webhook
Verifies provider signature, updates payment status, renews subscription.
