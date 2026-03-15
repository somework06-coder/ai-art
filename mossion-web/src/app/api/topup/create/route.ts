import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAYAR_API_KEY = process.env.MAYAR_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase with Service Role to bypass RLS for secure operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PACKS = {
    'starter': { name: 'Starter Pack', credits: 200, price: 20000 },
    'pro':     { name: 'Pro Pack', credits: 500, price: 35000 },
    'mega':    { name: 'Mega Pack', credits: 1000, price: 50000 },
};

export async function POST(req: Request) {
    try {
        if (!MAYAR_API_KEY) {
            return NextResponse.json({ error: 'Payment gateway is not configured yet.' }, { status: 500 });
        }

        const { uid, pack_id } = await req.json();

        if (!uid || !pack_id || !(pack_id in PACKS)) {
            return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
        }

        const pack = PACKS[pack_id as keyof typeof PACKS];

        // 1. Fetch user profile to get email and name
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (profileError || !profile) {
            console.error('Failed to fetch profile:', profileError);
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        // 2. Insert pending order into database
        const { data: order, error: orderError } = await supabase
            .from('topup_orders')
            .insert({
                user_id: uid,
                pack_name: pack.name,
                credits_amount: pack.credits,
                price: pack.price,
                status: 'pending',
                // payment_id will be updated below
            })
            .select()
            .single();

        if (orderError || !order) {
            console.error('Failed to create order:', orderError);
            return NextResponse.json({ error: 'Database error creating order' }, { status: 500 });
        }

        // 3. Create Mayar Payment Link
        // Mayar Headless API v1
        const mayarPayload = {
            name: profile.full_name || 'Mossion User',
            email: profile.email || 'user@mossion.app',
            amount: pack.price,
            description: `Mossion AI - ${pack.name} (${pack.credits} Credits)`,
            // The success URL returns them to the app's success page
            redirectUrl: `${req.headers.get('origin') || 'https://ai-art-iota.vercel.app'}/topup/success?order_id=${order.id}`,
        };

        const mayarRes = await fetch('https://api.mayar.id/hl/v1/payment/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MAYAR_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mayarPayload)
        });

        const mayarData = await mayarRes.json();

        if (!mayarRes.ok || !mayarData.data?.link) {
            console.error('Mayar API Error:', mayarData);
            return NextResponse.json({ error: 'Payment gateway error', details: mayarData }, { status: 502 });
        }

        // 4. Update order with Mayar's transaction/payment ID
        // Note: Mayar returns id in data.id and the checkout link in data.link
        await supabase
            .from('topup_orders')
            .update({ payment_id: mayarData.data.id })
            .eq('id', order.id);

        // 5. Return the checkout link to frontend
        return NextResponse.json({ link: mayarData.data.link });

    } catch (err: any) {
        console.error('/api/topup/create exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
