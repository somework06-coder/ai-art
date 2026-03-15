'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TopUpPack {
    id: string;
    name: string;
    credits: number;
    price: number;
    priceStr: string;
    description: string;
    popular?: boolean;
}

const PACKS: TopUpPack[] = [
    {
        id: 'starter',
        name: 'Starter Pack',
        credits: 200,
        price: 20000,
        priceStr: 'Rp 20.000',
        description: 'Perfect for trying out Mossion AI.'
    },
    {
        id: 'pro',
        name: 'Pro Pack',
        credits: 500,
        price: 35000,
        priceStr: 'Rp 35.000',
        description: 'Most popular for regular creators.',
        popular: true
    },
    {
        id: 'mega',
        name: 'Mega Pack',
        credits: 1000,
        price: 50000,
        priceStr: 'Rp 50.000',
        description: 'Best value for power users.'
    }
];

function TopUpContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const uid = searchParams.get('uid');

    const [loadingPack, setLoadingPack] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // If no UID is provided, we can't credit the user
    if (!uid) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-inter text-white">
                <div className="max-w-md w-full text-center space-y-4">
                    <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                    <h1 className="text-2xl font-bold">Invalid Request</h1>
                    <p className="text-gray-400">Please initiate the top-up from inside the Mossion Desktop App.</p>
                </div>
            </div>
        );
    }

    const handleBuy = async (pack: TopUpPack) => {
        setLoadingPack(pack.id);
        setError(null);

        try {
            const response = await fetch('/api/topup/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid,
                    pack_id: pack.id,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment link');
            }

            if (data.link) {
                // Redirect user to Mayar checkout page
                window.location.href = data.link;
            } else {
                throw new Error('No checkout link returned');
            }
        } catch (err: any) {
            console.error('Checkout error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
            setLoadingPack(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white font-inter selection:bg-[var(--accent)] selection:text-black">
            {/* Minimal Header */}
            <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(225,178,69,0.3)]">
                            <img src="/mossion logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-bold tracking-tight text-lg">Mossion</span>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Need More <span className="text-[var(--accent)]">Credits?</span></h1>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Select a top-up package to continue generating stunning, museum-quality 2D art.
                        Payments are processed securely via Mayar.id.
                    </p>
                </div>

                {error && (
                    <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
                        <span className="material-symbols-outlined">warning</span>
                        <p>{error}</p>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {PACKS.map(pack => (
                        <div
                            key={pack.id}
                            className={`relative bg-[#0d0d0d] border ${pack.popular ? 'border-[var(--accent)]' : 'border-white/10'} rounded-2xl p-8 flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group`}
                        >
                            {pack.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-black text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-[0_0_20px_rgba(225,178,69,0.5)]">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-bold mb-2">{pack.name}</h3>
                                <p className="text-gray-400 text-sm h-10">{pack.description}</p>
                            </div>

                            <div className="mb-8">
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-bold">{pack.priceStr}</span>
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full text-sm text-[var(--accent)] font-semibold border border-white/5 group-hover:bg-[var(--accent)]/10 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">stars</span>
                                    {pack.credits} Credits
                                </div>
                            </div>

                            <button
                                onClick={() => handleBuy(pack)}
                                disabled={loadingPack !== null}
                                className={`mt-auto w-full py-4 rounded-xl font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-2
                                    ${pack.popular
                                        ? 'bg-[var(--accent)] text-black hover:brightness-110 shadow-[0_0_20px_rgba(225,178,69,0.2)]'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                    }
                                    ${loadingPack === pack.id ? 'opacity-80 cursor-wait' : ''}
                                    ${loadingPack !== null && loadingPack !== pack.id ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {loadingPack === pack.id ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Checkout
                                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-16 text-center text-sm text-gray-500">
                    <p>Secure payments by <a href="https://mayar.id" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[var(--accent)] transition-colors">Mayar.id</a></p>
                </div>
            </main>
        </div>
    );
}

export default function TopUpPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--accent)] text-4xl animate-spin">progress_activity</span>
            </div>
        }>
            <TopUpContent />
        </Suspense>
    );
}
