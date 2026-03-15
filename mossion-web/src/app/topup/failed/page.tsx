'use client'

import Link from 'next/link'

export default function TopupFailedPage() {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-inter text-white">
            <div className="max-w-md w-full bg-[#0d0d0d] border border-red-500/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-500/20 blur-[60px] pointer-events-none rounded-full" />
                
                <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                    <span className="material-symbols-outlined text-4xl">cancel</span>
                </div>
                
                <h1 className="text-3xl font-bold mb-4">Payment Failed</h1>
                
                <p className="text-gray-300 mb-8">
                    We couldn't process your payment, or the transaction expired. No charges were made to your account.
                </p>
                
                <div className="flex flex-col gap-3 relative z-10">
                    <button 
                        onClick={() => window.history.back()}
                        className="w-full py-4 bg-[var(--accent)] text-black hover:brightness-110 rounded-xl font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(225,178,69,0.2)]"
                    >
                        Try Again
                    </button>
                    
                    <Link href="/" className="block w-full py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold tracking-wide transition-colors">
                        Go to Homepage
                    </Link>
                </div>
            </div>
        </div>
    );
}
