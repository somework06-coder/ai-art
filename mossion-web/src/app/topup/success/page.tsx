'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SuccessContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('order_id');

    return (
        <div className="max-w-md w-full bg-[#0d0d0d] border border-green-500/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(34,197,94,0.1)] relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-green-500/20 blur-[60px] pointer-events-none rounded-full" />
            
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            
            <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
            
            <p className="text-gray-300 mb-2">
                Your credits have been successfully added to your Mossion account.
            </p>
            
            {orderId && (
                <p className="text-xs text-gray-500 mb-8 font-mono bg-black/50 p-2 rounded-lg inline-block border border-white/5">
                    Order ID: {orderId}
                </p>
            )}
            
            <div className="space-y-4 relative z-10">
                <p className="text-sm font-semibold text-[var(--accent)] bg-[var(--accent)]/10 py-3 rounded-xl border border-[var(--accent)]/20">
                    You can now safely close this window and return to the Mossion Desktop App.
                </p>
                
                <Link href="/" className="block w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold tracking-wide transition-colors">
                    Go to Homepage
                </Link>
            </div>
        </div>
    );
}

export default function TopupSuccessPage() {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-inter text-white">
            <Suspense fallback={<div className="animate-pulse flex flex-col items-center"><div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin mb-4"></div><p>Loading receipt...</p></div>}>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
