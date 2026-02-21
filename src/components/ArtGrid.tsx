'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GeneratedShader } from '@/types';
import ArtCanvas, { ArtCanvasRef } from './ArtCanvas';
import { useDownloadQueue } from './DownloadQueueProvider';

interface ArtGridProps {
    shaders: GeneratedShader[];
}

export default function ArtGrid({ shaders }: ArtGridProps) {
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [exportShaders, setExportShaders] = useState<GeneratedShader[] | null>(null);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    if (shaders.length === 0) {
        return (
            <div className="art-grid-empty">
                <span className="material-symbols-outlined empty-icon" style={{ fontSize: '64px' }}>palette</span>
                <p>Your generated art will appear here</p>
                <p className="empty-hint">Enter a prompt or generate random art to begin</p>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: selectedIds.size > 0 ? '80px' : '0' }}>
            <div className="flex justify-end mb-4 px-4">
                <button
                    onClick={() => {
                        setSelectionMode(!selectionMode);
                        if (selectionMode) setSelectedIds(new Set()); // Clear when disabling
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectionMode ? 'bg-[#E1B245] text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                >
                    {selectionMode ? 'Cancel Selection' : 'Select for Bulk Export'}
                </button>
            </div>

            <div className={`art-grid ${shaders.length === 1 ? 'single' : shaders.length === 2 ? 'double' : 'multi'}`}>
                {shaders.map((shader) => (
                    <ArtItem
                        key={shader.id}
                        shader={shader}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.has(shader.id)}
                        onToggleSelect={() => toggleSelection(shader.id)}
                        onExportSingle={(shader) => setExportShaders([shader])}
                    />
                ))}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#121212] border-t border-white/10 p-4 z-40 flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transform transition-transform translate-y-0 text-left" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
                    <div className="max-w-[1200px] mx-auto w-full flex justify-between items-center">
                        <div className="text-white">
                            <span className="text-[#E1B245] font-bold text-xl">{selectedIds.size}</span> artworks selected
                        </div>
                        <button
                            className="bg-[#E1B245] text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[#E1B245]/20 transition-all active:scale-95"
                            onClick={() => {
                                setExportShaders(shaders.filter(s => selectedIds.has(s.id)));
                            }}
                        >
                            <span className="material-symbols-outlined">library_add_check</span>
                            Bulk Export
                        </button>
                    </div>
                </div>
            )}
            {/* Export Settings Modal - Handles single and bulk combinations */}
            {exportShaders && (
                <ExportModal
                    shaders={exportShaders}
                    onClose={() => {
                        setExportShaders(null);
                        setSelectionMode(false);
                        setSelectedIds(new Set());
                    }}
                />
            )}
        </div>
    );
}

// -------------------------------------------------------------------------------- //
// Global Export Modal Component (Handles Single & Bulk)
// -------------------------------------------------------------------------------- //
function ExportModal({ shaders, onClose }: { shaders: GeneratedShader[], onClose: () => void }) {
    const { addJob } = useDownloadQueue();
    const [quality, setQuality] = useState('HD');
    const [compression, setCompression] = useState('Medium');
    const [fps, setFps] = useState(30);
    const [format, setFormat] = useState('mp4');

    // For bulk, we just display the duration of the first item as a rough guide, 
    // but the actual duration dispatched is per-shader.
    const guideDuration = shaders[0]?.duration || 10;
    const isBulk = shaders.length > 1;

    const estimateFileSize = () => {
        let baseBitrate = 5;
        if (quality === '4K') baseBitrate = 40;
        else if (quality === 'FHD') baseBitrate = 12;

        let compressionMulti = 1;
        if (compression === 'Medium') compressionMulti = 0.55;
        else if (compression === 'Low') compressionMulti = 0.3;

        const bitrateMbps = baseBitrate * compressionMulti * (fps / 30);
        // Estimate size for all selected shaders combined
        const totalDuration = shaders.reduce((acc, s) => acc + (s.duration || 10), 0);
        const sizeMB = (bitrateMbps * totalDuration) / 8;

        return Math.max(0.5, sizeMB).toFixed(1);
    };

    const startBulkExport = () => {
        // Formulate base estimates
        const baseTime = quality === '4K' ? 4000 : quality === 'FHD' ? 1500 : 700;
        const crfMulti = compression === 'High' ? 1.5 : compression === 'Medium' ? 1.0 : 0.8;

        const crfValue =
            compression === 'High' ? 18
                : compression === 'Medium' ? 23
                    : 28;

        // Dispatch a pending job to the persistent Download Queue for EACH shader
        shaders.forEach((shader, index) => {
            const shaderDuration = shader.duration || 10;
            const estimatedTimeMs = baseTime * shaderDuration * (fps / 30) * crfMulti;
            const jobId = `local-${Date.now()}-${index}`;

            addJob({
                jobId,
                artworkId: shader.id,
                status: 'pending',
                format,
                title: shader.prompt.substring(0, 30) + '...',
                progress: 0,
                statusText: `Waiting to render...`,
                estimatedTimeMs,
                startTimeMs: Date.now(),
                shaderCode: shader.fragmentCode,
                aspectRatio: shader.aspectRatio || '16:9',
                quality,
                crf: crfValue,
                duration: shaderDuration,
                fps
            });
        });

        onClose(); // Close immediately so the user can continue using the dashboard
    };

    return createPortal(
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="modal-content" style={{
                background: '#141414', padding: '24px', borderRadius: '16px',
                border: '1px solid #333', width: '360px', maxWidth: '90%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700 }}>{isBulk ? 'Bulk Export' : 'Export Video'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '20px' }}>✕</button>
                </div>
                {isBulk && (
                    <p className="text-sm text-[#E1B245] mb-4">You are queueing {shaders.length} artworks for background rendering.</p>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="section-label">Quality</label>
                    <div className="custom-select-wrapper">
                        <select
                            value={quality}
                            onChange={(e) => setQuality(e.target.value)}
                            className="custom-select"
                        >
                            <option value="HD">HD (720p)</option>
                            <option value="FHD">Full HD (1080p)</option>
                            <option value="4K">4K (Ultra HD)</option>
                        </select>
                        <span className="material-symbols-outlined select-icon">expand_more</span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="section-label">Compression</label>
                    <div className="custom-select-wrapper">
                        <select
                            value={compression}
                            onChange={(e) => setCompression(e.target.value)}
                            className="custom-select"
                        >
                            <option value="High">High Quality (Larger File)</option>
                            <option value="Medium">Medium Quality (Balanced)</option>
                            <option value="Low">Low Quality (Smallest File)</option>
                        </select>
                        <span className="material-symbols-outlined select-icon">expand_more</span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="section-label">Format</label>
                    <div className="custom-select-wrapper">
                        <select
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            className="custom-select"
                        >
                            <option value="mp4">MP4 (H.264)</option>
                            <option value="mov">MOV (H.264)</option>
                        </select>
                        <span className="material-symbols-outlined select-icon">expand_more</span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="section-label">Duration</label>
                    <div style={{
                        width: '100%', padding: '12px', background: '#0a0a0a',
                        color: '#888', borderRadius: '8px', border: '1px solid #333',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_clock</span>
                        {isBulk ? 'Using Original Loop Durations' : `${guideDuration} Seconds (Fixed Loop)`}
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label className="section-label">Framerate</label>
                    <div className="custom-select-wrapper">
                        <select
                            value={fps}
                            onChange={(e) => setFps(Number(e.target.value))}
                            className="custom-select"
                        >
                            <option value="30">30 FPS (Standard)</option>
                            <option value="60">60 FPS (Smooth)</option>
                        </select>
                        <span className="material-symbols-outlined select-icon">expand_more</span>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label className="section-label">Estimated File Size</label>
                    <div style={{
                        width: '100%', padding: '12px', background: 'rgba(255, 215, 0, 0.1)',
                        color: '#ffd700', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.2)',
                        fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                        fontWeight: 500
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sd_storage</span>
                        ~{estimateFileSize()} MB
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '14px', background: 'transparent',
                            border: '1px solid #333', borderRadius: '8px', color: '#888',
                            cursor: 'pointer', fontWeight: 600, fontSize: '13px'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={startBulkExport}
                        className="generate-btn"
                        style={{ flex: 1 }}
                    >
                        {isBulk ? 'Export' : 'Start Export'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Individual Art Item with Modal
function ArtItem({
    shader,
    selectionMode,
    isSelected,
    onToggleSelect,
    onExportSingle
}: {
    shader: GeneratedShader,
    selectionMode?: boolean,
    isSelected?: boolean,
    onToggleSelect?: () => void,
    onExportSingle: (shader: GeneratedShader) => void
}) {
    const { jobs } = useDownloadQueue();
    const canvasRef = useRef<ArtCanvasRef | null>(null);

    const activeJob = jobs.find(j => j.artworkId === shader.id && (j.status === 'pending' || j.status === 'processing'));

    const [justFinished, setJustFinished] = useState(false);
    const prevActiveJobRef = useRef(activeJob);

    useEffect(() => {
        if (prevActiveJobRef.current && !activeJob) {
            // Job finished or failed
            const latestJob = jobs.slice().reverse().find(j => j.artworkId === shader.id);
            if (latestJob?.status === 'completed') {
                setJustFinished(true);
                const timer = setTimeout(() => setJustFinished(false), 3000);
                return () => clearTimeout(timer);
            }
        }
        prevActiveJobRef.current = activeJob;
    }, [activeJob, jobs, shader.id]);



    return (
        <div className="art-item">
            <div className="art-item-visual relative" onClick={() => !selectionMode && canvasRef.current && canvasRef.current.toggleFullscreen()}>
                <ArtCanvas
                    ref={canvasRef}
                    shaderCode={shader.fragmentCode}
                    aspectRatio={shader.aspectRatio}
                />

                {/* Selection Overlay */}
                {selectionMode && (
                    <div
                        className="absolute inset-0 z-30 flex items-start justify-end p-4 cursor-pointer bg-black/10 hover:bg-black/20 transition-colors"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleSelect?.();
                        }}
                    >
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-lg ${isSelected ? 'bg-[#E1B245] border-[#E1B245]' : 'border-white/80 bg-black/40 backdrop-blur-sm hover:border-[#E1B245]'}`}>
                            {isSelected && <span className="material-symbols-outlined text-black font-bold" style={{ fontSize: '18px' }}>check</span>}
                        </div>
                    </div>
                )}
            </div>

            <div className="art-item-info">
                <p className="art-prompt">
                    {shader.prompt.length > 60 ? shader.prompt.substring(0, 60) + '...' : shader.prompt}
                </p>
                <span className="art-ratio">{shader.aspectRatio}</span>
                <span className="art-duration">{shader.duration || 10}s Loop</span>
            </div>

            <div className="art-item-actions">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="download-btn"
                        onClick={justFinished ? undefined : () => onExportSingle(shader)}
                        style={{
                            flex: 1,
                            cursor: activeJob ? 'wait' : justFinished ? 'default' : 'pointer',
                            ...(activeJob ? {
                                backgroundColor: 'rgba(225, 178, 69, 0.15)',
                                borderColor: '#E1B245',
                                color: '#E1B245',
                                boxShadow: '0 0 10px rgba(225, 178, 69, 0.3)'
                            } : justFinished ? {
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                borderColor: '#10b981',
                                color: '#10b981'
                            } : {})
                        }}
                        disabled={!!activeJob}
                    >
                        {activeJob ? (
                            <>
                                <span className="material-symbols-outlined animate-spin text-[#E1B245]" style={{ fontSize: '18px' }}>progress_activity</span>
                                Rendering...
                            </>
                        ) : justFinished ? (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                                Saved
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">download</span> Export
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Ensure the ArtGrid also maps this prop when looping through items!
