
import { createClient } from "@/utils/supabase/server"
import Link from "next/link"
import AuthButton from "./AuthButton"
import DownloadCenter from "./DownloadCenter"

export default async function Navbar() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 15px rgba(225,178,69,0.15)',
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: '22px',
                            color: '#000',
                        }}>brush</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{
                            fontWeight: 700,
                            fontSize: '18px',
                            color: '#fff',
                            letterSpacing: '-0.3px',
                            lineHeight: 1,
                        }}>Motion Studio</span>
                        <span style={{
                            fontSize: '9px',
                            color: '#666',
                            fontWeight: 500,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '1.5px',
                            lineHeight: 1,
                            marginTop: '3px',
                        }}>AI Generative Art</span>
                    </div>
                </Link>

                {/* Right Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                }}>
                    <DownloadCenter />
                    <AuthButton user={user} />
                </div>
            </div>
        </nav>
    )
}
