'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function TopUpIframe() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const uid = searchParams.get('uid');
    const [isLoading, setIsLoading] = useState(true);

    if (!uid) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-inter text-white">
                <div className="max-w-md w-full text-center space-y-4">
                    <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                    <h1 className="text-2xl font-bold">Invalid Request</h1>
                    <p className="text-gray-400">Please initiate top-up properly.</p>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-white/10 rounded-lg mt-4">Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#050505] text-white font-inter">
            {/* Header with Back Button */}
            <header className="flex-none border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-2"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="font-semibold">Back to App</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="font-bold tracking-tight text-lg text-white">Secure Payment</span>
                    </div>
                </div>
            </header>

            {/* Embedded Live Checkout Flow */}
            <main className="flex-1 relative w-full h-full bg-[#050505]">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10 bg-[#050505]">
                        <span className="material-symbols-outlined text-[var(--accent)] text-5xl animate-spin">progress_activity</span>
                        <span className="text-gray-400 text-lg font-medium">Connecting to Mayar.id...</span>
                    </div>
                )}
                <iframe 
                    src={`https://ai-art-iota.vercel.app/topup?uid=${uid}`}
                    className={`w-full h-full border-0 transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setIsLoading(false)}
                    allow="payment"
                />
            </main>
        </div>
    );
}

export default function DesktopTopUpPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--accent)] text-4xl animate-spin">progress_activity</span>
            </div>
        }>
            <TopUpIframe />
        </Suspense>
    );
}
