'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDownloadQueue, ExportJob } from '@/components/DownloadQueueProvider';

function JobProgress({ job }: { job: ExportJob }) {
    const [simulatedProgress, setSimulatedProgress] = useState(job.progress || 0);
    const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

    useEffect(() => {
        // Only run simulation if it's processing and has tracking fields
        if (job.status !== 'processing' || !job.startTimeMs || !job.estimatedTimeMs) {
            setSimulatedProgress(job.progress || 0);
            setTimeRemaining(null);
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - job.startTimeMs!;
            let pct = (elapsed / job.estimatedTimeMs!) * 100;

            if (pct > 95) pct = 95; // Cap at 95% until server actually finishes

            setSimulatedProgress(pct);

            const msRemaining = Math.max(0, job.estimatedTimeMs! - elapsed);
            if (msRemaining > 0) {
                const secs = Math.ceil(msRemaining / 1000);
                if (secs > 60) {
                    setTimeRemaining(`~${Math.floor(secs / 60)}m ${secs % 60}s left`);
                } else {
                    setTimeRemaining(`~${secs}s left`);
                }
            } else {
                setTimeRemaining(`Finishing up...`);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [job.status, job.startTimeMs, job.estimatedTimeMs, job.progress]);

    // Ensure it immediately hits 100% when server done
    const displayProgress = job.status === 'completed' ? 100 : Math.max(simulatedProgress, job.progress || 0);

    return (
        <div className="w-full mt-3">
            <div className="flex justify-between items-end mb-1.5 px-0.5">
                <p className="text-[10px] text-white/60">{job.statusText || 'Rendering...'}</p>
                {timeRemaining && job.status === 'processing' && (
                    <p className="text-[10px] text-[#E1B245] font-medium animate-pulse">{timeRemaining}</p>
                )}
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                    className="bg-[#E1B245] h-full rounded-full transition-all duration-500 ease-linear shadow-[0_0_8px_rgba(225,178,69,0.5)]"
                    style={{ width: `${displayProgress}%` }}
                />
            </div>
        </div>
    );
}

export default function DownloadCenter() {
    const { jobs, clearCompleted } = useDownloadQueue();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeJobsCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
    const completedJobsCount = jobs.filter(j => j.status === 'completed').length;
    const badgeCount = activeJobsCount + completedJobsCount;

    const [totalProgress, setTotalProgress] = useState(0);

    useEffect(() => {
        const processingJobs = jobs.filter(j => j.status === 'processing' && j.startTimeMs && j.estimatedTimeMs);

        if (processingJobs.length === 0) {
            setTotalProgress(0);
            return;
        }

        const interval = setInterval(() => {
            let totalPct = 0;
            const now = Date.now();

            processingJobs.forEach(job => {
                const elapsed = now - job.startTimeMs!;
                let pct = (elapsed / job.estimatedTimeMs!) * 100;
                if (pct > 95) pct = 95; // Cap at 95%
                totalPct += pct;
            });

            setTotalProgress(totalPct / processingJobs.length);
        }, 100); // Fast interval for smooth water rising

        return () => clearInterval(interval);
    }, [jobs]);

    const [justCompleted, setJustCompleted] = useState(false);
    const prevCompletedCountRef = useRef(completedJobsCount);

    useEffect(() => {
        if (completedJobsCount > prevCompletedCountRef.current) {
            setJustCompleted(true);
            const timer = setTimeout(() => setJustCompleted(false), 2500);
            prevCompletedCountRef.current = completedJobsCount;
            return () => clearTimeout(timer);
        } else {
            prevCompletedCountRef.current = completedJobsCount;
        }
    }, [completedJobsCount]);

    // Auto-open side panel when a new job is queued
    const prevJobsLengthRef = useRef(jobs.length);
    useEffect(() => {
        if (jobs.length > prevJobsLengthRef.current) {
            setIsOpen(true);
        }
        prevJobsLengthRef.current = jobs.length;
    }, [jobs.length]);

    // Removed handleClickOutside because Portal elements trigger as outside the dropdownRef

    const [isZipping, setIsZipping] = useState(false);
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isOpen) {
            setIsSelectMode(false);
            setSelectedJobIds(new Set());
            setShowConfirmPopup(false);
        }
    }, [isOpen]);

    const toggleJobSelection = (jobId: string) => {
        const newSet = new Set(selectedJobIds);
        if (newSet.has(jobId)) newSet.delete(jobId);
        else newSet.add(jobId);
        setSelectedJobIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedJobIds.size === completedJobsCount) {
            setSelectedJobIds(new Set());
        } else {
            const allCompleted = jobs.filter(j => j.status === 'completed' && j.videoUrl).map(j => j.jobId);
            setSelectedJobIds(new Set(allCompleted));
        }
    };

    const handleDownloadAllZip = async () => {
        if (isZipping) return;
        setIsZipping(true);
        try {
            const JSZip = (await import('jszip')).default;

            const zip = new JSZip();
            const itemsToZip = jobs.filter(j => selectedJobIds.has(j.jobId) && j.status === 'completed' && j.videoUrl);

            await Promise.all(itemsToZip.map(async (job, index) => {
                const response = await fetch(job.videoUrl as string);
                const blob = await response.blob();
                // Add a short ID snippet to guarantee unique filenames within the ZIP
                const safeName = `${job.title || 'Video'}_${job.jobId.slice(-4)}.${job.format || 'mp4'}`.replace(/[^a-z0-9_.-]/gi, '_');
                zip.file(safeName, blob);
            }));

            const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
            const zipBlob = new Blob([content], { type: 'application/zip' });
            const { saveAs } = await import('file-saver');
            saveAs(zipBlob, `MotionStudio_Exports_${Date.now()}.zip`);

            setShowConfirmPopup(false);
        } catch (error) {
            console.error('Failed to create ZIP:', error);
            alert('Failed to generate ZIP file.');
        } finally {
            setIsZipping(false);
        }
    };

    const handleDownload = (videoUrl: string, title?: string, format?: string) => {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `${title || 'MotionStudio_Export'}.${format || 'mp4'}`.replace(/[^a-z0-9_.-]/gi, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className={`flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-all duration-500 relative ${justCompleted
                    ? 'border-[#E1B245] shadow-[0_0_20px_rgba(225,178,69,0.6)] scale-110 -translate-y-1'
                    : 'border-white/10 border bg-white/5'
                    }`}
                onClick={() => setIsOpen(!isOpen)}
                title="Download Center"
            >
                {/* Liquid Fill Container -> Keeps overflow hidden away from the badge */}
                <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{
                        background: activeJobsCount > 0
                            ? `linear-gradient(to top, rgba(225,178,69,0.35) ${totalProgress}%, rgba(255,255,255,0.0) ${totalProgress}%)`
                            : 'transparent'
                    }}
                >
                    {/* Simulated wavy top for the water effect */}
                    {activeJobsCount > 0 && (
                        <div
                            className="absolute inset-x-0 bg-[#E1B245]/40 opacity-50 wobble-animation"
                            style={{ bottom: `${totalProgress}%`, height: '2px', filter: 'blur(1px)' }}
                        />
                    )}
                </div>

                <span className={`material-symbols-outlined transition-colors duration-500 z-10 ${justCompleted ? 'text-[#E1B245]' : activeJobsCount > 0 ? 'text-[#E1B245] animate-pulse' : 'text-white'}`} style={{ fontSize: '20px' }}>download</span>
                {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#E1B245] text-black text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full z-20 shadow-md">
                        {badgeCount}
                    </span>
                )}
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9990]"
                        onClick={() => setIsOpen(false)}
                        style={{ animation: 'fadeIn 0.2s ease-out' }}
                    />

                    {/* Side Panel */}
                    <div
                        className="fixed top-0 right-0 h-[100dvh] min-h-[100dvh] max-h-screen w-[400px] max-w-[90vw] bg-[#121212] border-l border-white/10 shadow-2xl z-[9991] flex flex-col"
                        style={{ animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40 flex-shrink-0">
                            <h3 className="font-semibold text-white text-base">
                                {isSelectMode ? `${selectedJobIds.size} Selected` : 'Export Queue'}
                            </h3>
                            <div className="flex gap-2 items-center">
                                {isSelectMode ? (
                                    <>
                                        <button onClick={handleSelectAll} className="text-xs text-white/50 hover:text-white transition-colors mr-2">
                                            {selectedJobIds.size === completedJobsCount ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <button onClick={() => setIsSelectMode(false)} className="text-xs border border-white/20 text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors">
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {completedJobsCount > 1 && (
                                            <button
                                                onClick={() => setIsSelectMode(true)}
                                                className="text-xs border border-white/20 text-white px-3 py-1.5 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">checklist</span>
                                                Select
                                            </button>
                                        )}
                                        {jobs.length > 0 && (
                                            <button onClick={clearCompleted} className="text-xs text-white/50 hover:text-white transition-colors ml-2">
                                                Clear
                                            </button>
                                        )}
                                    </>
                                )}
                                <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors grid place-items-center ml-2 border-l border-white/10 pl-2">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 h-full w-full">
                            {jobs.length === 0 ? (
                                <div className="p-10 text-center text-white/50 text-sm flex flex-col items-center justify-center h-full pt-32">
                                    <span className="material-symbols-outlined text-5xl mb-3 opacity-30">inbox</span>
                                    <p>No active exports.</p>
                                    <p className="text-xs mt-1 text-white/30">Export an artwork to see it here.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-white/5 w-full h-full flex flex-col">
                                    {jobs.slice().reverse().map(job => (
                                        <li
                                            key={job.jobId}
                                            className={`p-5 transition-colors cursor-pointer ${isSelectMode && job.status === 'completed' ? 'hover:bg-white/10 active:bg-white/5' : 'hover:bg-white/5'}`}
                                            onClick={() => {
                                                if (isSelectMode && job.status === 'completed') {
                                                    toggleJobSelection(job.jobId);
                                                }
                                            }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                {isSelectMode && job.status === 'completed' && (
                                                    <div className="mr-3 mt-0.5 flex-shrink-0">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedJobIds.has(job.jobId) ? 'bg-[#E1B245] border-[#E1B245]' : 'border-white/30 bg-black/20'}`}>
                                                            {selectedJobIds.has(job.jobId) && <span className="material-symbols-outlined text-[14px] text-black font-bold">check</span>}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex-1 pr-4 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate" title={job.title}>{job.title || 'Untitled Video'}</p>
                                                    <p className="text-xs text-white/50 uppercase mt-0.5">{job.format || 'MP4'}</p>
                                                </div>

                                                {!isSelectMode && (
                                                    <>
                                                        {job.status === 'completed' && job.videoUrl ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDownload(job.videoUrl as string, job.title, job.format); }}
                                                                className="bg-[#E1B245] text-black w-8 h-8 rounded hover:brightness-110 flex-shrink-0 transition-transform active:scale-95 flex items-center justify-center shadow-lg shadow-[#E1B245]/20"
                                                                title="Save to device"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">save_alt</span>
                                                            </button>
                                                        ) : job.status === 'failed' ? (
                                                            <span className="material-symbols-outlined text-red-500 text-[18px]" title="Export failed">error</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[#E1B245] animate-spin text-[18px]">progress_activity</span>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {(job.status === 'pending' || job.status === 'processing') && (
                                                <JobProgress job={job} />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Footer Download Action */}
                        {isSelectMode && selectedJobIds.size > 0 && (
                            <div className="p-5 border-t border-white/10 flex-shrink-0 bg-black/40">
                                <button
                                    onClick={() => setShowConfirmPopup(true)}
                                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-black bg-[#E1B245] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(225,178,69,0.3)]"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Download All ({selectedJobIds.size})
                                </button>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}

            {/* Premium Confirmation Popup for Zip All */}
            {showConfirmPopup && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" style={{ animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#E1B245]/10 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-[#E1B245] text-3xl">download</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Confirm Download</h3>
                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                Are you sure you want to download the selected {selectedJobIds.size} file(s) as a ZIP archive?
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmPopup(false)}
                                    className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDownloadAllZip}
                                    disabled={isZipping}
                                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-black bg-[#E1B245] hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(225,178,69,0.3)] disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isZipping ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">download</span>}
                                    {isZipping ? 'Downloading...' : 'Download All'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

