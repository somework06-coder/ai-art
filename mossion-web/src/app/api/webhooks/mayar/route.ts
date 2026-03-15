import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const MAYAR_WEBHOOK_SECRET = process.env.MAYAR_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: Request) {
    try {
        if (!MAYAR_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
        }

        const bodyRaw = await req.text();
        const signature = req.headers.get('x-mayar-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
        }

        // Verify Mayar HMAC SHA256 Signature
        const expectedSignature = crypto
            .createHmac('sha256', MAYAR_WEBHOOK_SECRET)
            .update(bodyRaw)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('Webhook signature mismatch', { expected: expectedSignature, received: signature });
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(bodyRaw);

        // Mayar sends events, we care about successful payments
        // Event type might vary, usually it's "payment.success"
        // Let's assume the payload directly contains status or event name
        const isPaid = payload.status === 'paid' || payload.status === 'settled';

        if (!isPaid) {
            // Ignore pending or failed callbacks
            return NextResponse.json({ received: true, ignored: true });
        }

        const paymentId = payload.id || payload.transaction_id;

        // 1. Find the pending order
        const { data: order, error: orderError } = await supabase
            .from('topup_orders')
            .select('*')
            .eq('payment_id', paymentId)
            .single();

        if (orderError || !order) {
            console.error('Webhook matched no order:', paymentId);
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.status === 'paid') {
            // Idempotent: already processed
            return NextResponse.json({ received: true, already_processed: true });
        }

        // 2. Fetch current user profile to safely add credits
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', order.user_id)
            .single();

        if (profileError || !profile) {
            console.error('Failed to find user profile for order:', order.user_id);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 3. Mark order as Paid AND Add Credits (Use RPC function for atomicity in production, but discrete updates work too)
        const updatedCredits = profile.credits + order.credits_amount;

        const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ credits: updatedCredits })
            .eq('id', order.user_id);

        if (updateProfileError) {
            console.error('Failed to add credits:', updateProfileError);
            return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
        }

        const { error: updateOrderError } = await supabase
            .from('topup_orders')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString()
            })
            .eq('id', order.id);

        if (updateOrderError) {
            console.error('Failed to mark order as paid:', updateOrderError);
            // Non-fatal, user got the credits, but admin dashboard will be outdated.
        }

        return NextResponse.json({ success: true, order_id: order.id, credits_added: order.credits_amount });

    } catch (err: any) {
        console.error('Webhook error:', err);
        return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
    }
}
