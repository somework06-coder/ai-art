'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface TopUpButtonProps {
    user: User;
}

export default function TopUpButton({ user }: TopUpButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleTopUp = () => {
        setIsLoading(true);
        router.push(`/topup?uid=${user.id}`);
        // Remove loading state quickly so it's not stuck when navigating back
        setTimeout(() => setIsLoading(false), 500);
    };

    return (
        <button 
            onClick={handleTopUp}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent)] hover:brightness-110 text-black shadow-[0_0_15px_rgba(225,178,69,0.3)] transition-all font-bold disabled:opacity-70 disabled:cursor-not-allowed"
            title="Get More Credits"
        >
            {isLoading ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
            )}
            <span className="text-[12px] uppercase tracking-wider">Top Up</span>
        </button>
    );
}
