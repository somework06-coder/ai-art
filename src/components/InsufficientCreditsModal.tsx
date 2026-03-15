'use client';

import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { createClient } from '@/utils/supabase/client';

interface InsufficientCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    requiredCredits: number;
    currentCredits: number;
}

export default function InsufficientCreditsModal({
    isOpen,
    onClose,
    requiredCredits,
    currentCredits
}: InsufficientCreditsModalProps) {
    const [shouldRender, setShouldRender] = useState(false);
    const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isOpen) setShouldRender(true);
    }, [isOpen]);

    const handleAnimationEnd = () => {
        if (!isOpen) setShouldRender(false);
    };

    const handleTopUp = async () => {
        setIsOpeningBrowser(true);
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await open(`https://ai-art-iota.vercel.app/topup?uid=${user.id}`);
            }
        } catch (error) {
            console.error('Failed to open browser:', error);
        } finally {
            setIsOpeningBrowser(false);
            onClose();
        }
    };

    if (!shouldRender) return null;

    return (
        <div
            className={`modal-overlay ${isOpen ? 'fade-in' : 'fade-out'}`}
            onAnimationEnd={handleAnimationEnd}
            onClick={onClose}
        >
            <div
                className={`modal-content error-tint ${isOpen ? 'slide-up' : 'slide-down'}`}
                onClick={e => e.stopPropagation()}
            >
                <button className="modal-close" onClick={onClose}>
                    <span className="material-symbols-outlined">close</span>
                </button>

                <div className="modal-icon-wrapper warning">
                    <span className="material-symbols-outlined modal-icon">
                        account_balance_wallet
                    </span>
                </div>

                <h2>Not Enough Credits</h2>

                <div className="modal-info-box warning">
                    <div className="credit-comparison">
                        <div className="credit-stat">
                            <span className="stat-label">Your Balance</span>
                            <span className="stat-value text-red-400">{currentCredits}</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="credit-stat">
                            <span className="stat-label">Required</span>
                            <span className="stat-value text-yellow-500">{requiredCredits}</span>
                        </div>
                    </div>
                </div>

                <p className="modal-body text-gray-300">
                    You need {requiredCredits} credit{requiredCredits > 1 ? 's' : ''} to generate this art, but you only have {currentCredits}.
                </p>

                <div className="modal-actions">
                    <button 
                        className="auth-button primary-button w-full"
                        onClick={handleTopUp}
                        disabled={isOpeningBrowser}
                    >
                        {isOpeningBrowser ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined">add_circle</span>
                        )}
                        {isOpeningBrowser ? 'Opening Browser...' : 'Get More Credits'}
                    </button>
                    <button className="secondary-button" onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
