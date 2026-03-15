import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const userIdToUpdate = resolvedParams.id;
        const { credits } = await request.json();

        if (typeof credits !== 'number') {
            return NextResponse.json({ error: 'Invalid credits value' }, { status: 400 });
        }

        // 1. Verify the requester is an admin using their cookie session
        const supabaseUser = await createServerClient();
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabaseUser
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (!profile?.is_admin) {
            return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
        }

        // 2. Initialize Admin Client to bypass RLS and update the target user's profile
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Fetch old credits for transaction logging
        const { data: targetProfile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('credits')
            .eq('id', userIdToUpdate)
            .single();

        if (fetchError || !targetProfile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const difference = credits - (targetProfile.credits || 0);

        // Only update if there's an actual change
        if (difference !== 0) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ credits })
                .eq('id', userIdToUpdate);

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            // Record transaction representing the admin manual credit adjustment
            const { error: txError } = await supabaseAdmin
                .from('credit_transactions')
                .insert({
                    user_id: userIdToUpdate,
                    amount: difference,
                    description: `Admin manual adjustment (by ${user.email || 'Admin'})`
                });

            if (txError) {
                console.error("Failed to insert transaction log:", txError);
                // Return success anyway, since the profile update succeeded
            }
        }

        return NextResponse.json({ success: true, new_credits: credits });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
