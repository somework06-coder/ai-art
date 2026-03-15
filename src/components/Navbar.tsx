'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import AuthButton from "@/components/AuthButton"
import DownloadCenter from "@/components/DownloadCenter"
import OfflineIndicator from "@/components/OfflineIndicator"
import TopUpButton from "@/components/TopUpButton"
import type { User } from '@supabase/supabase-js'
import { useCredits } from "@/hooks/useCredits"

export default function Navbar() {
    const [user, setUser] = useState<User | null>(null)
    const pathname = usePathname()
    const { credits } = useCredits()

    useEffect(() => {
        const supabase = createClient()

        // Initial fetch
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user)
        })

        // Listen for auth changes (login/out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null)
        })

        return () => subscription.unsubscribe()
    }, [])

    return (
        <nav style={{
            width: '100%',
            height: '64px',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
        }}>
            <div style={{
                width: '100%',
                height: '100%',
                padding: '0 40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                {/* Brand Logo */}
                <Link href="/" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textDecoration: 'none',
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 0 15px rgba(225,178,69,0.15)',
                    }}>
                        <img
                            src="/mossion logo.jpg"
                            alt="Mossion Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontWeight: 800,
                            fontSize: '20px',
                            color: '#fff',
                            letterSpacing: '0.5px',
                            lineHeight: 1,
                        }}>MOSSION</span>
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--accent)',
                            fontWeight: 500,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '1px',
                            lineHeight: 1,
                            marginTop: '3px',
                        }}>Design the unseen</span>
                    </div>
                </Link>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    <OfflineIndicator />
                    {user && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-inner">
                                <span className="text-[11px] font-bold text-[#E1B245] uppercase tracking-wider">Credits</span>
                                <span className="text-sm font-black text-white">{credits}</span>
                            </div>
                            <TopUpButton user={user} />
                        </div>
                    )}
                    {(user && pathname !== '/login') && <DownloadCenter />}
                    <AuthButton user={user} />
                </div>
            </div>
        </nav>
    )
}

