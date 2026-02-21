import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Readable, PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface ExportRequest {
    shaderCode: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    quality: 'HD' | 'FHD' | '4K';
    duration: number;
    fps?: number;
    format?: 'mp4' | 'mov';
    crf?: number;
}

function getResolution(aspectRatio: string, quality: string): { width: number; height: number } {
    let baseWidth, baseHeight;

    // Base resolution logic (HD 720p base)
    switch (aspectRatio) {
        case '16:9': baseWidth = 1280; baseHeight = 720; break;
        case '9:16': baseWidth = 720; baseHeight = 1280; break;
        case '1:1': baseWidth = 720; baseHeight = 720; break;
        default: baseWidth = 1280; baseHeight = 720;
    }

    // Scale based on quality
    let scale = 1;
    if (quality === 'FHD') scale = 1.5; // 1080p (approx 1920x1080)
    if (quality === '4K') scale = 3;    // 4K (approx 3840x2160)

    return {
        width: Math.round(baseWidth * scale),
        height: Math.round(baseHeight * scale)
    };
}


export async function POST(request: NextRequest) {
    // 1. Check for External Video Service (VPS Mode)
    const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL;

    if (VIDEO_SERVICE_URL) {
        try {
            console.log(`Proxying video export to ${VIDEO_SERVICE_URL}...`);
            const body = await request.json();

            const response = await fetch(`${VIDEO_SERVICE_URL}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Service Error: ${error}`);
            }

            // Stream the video back to the client
            const format = body.format || 'mp4';
            return new NextResponse(response.body, {
                headers: {
                    'Content-Type': `video/${format}`,
                    'Content-Disposition': `attachment; filename="video.${format}"`,
                },
            });

        } catch (error) {
            console.error('Proxy Error:', error);
            return NextResponse.json({ error: 'Failed to offload video generation.' }, { status: 502 });
        }
    }

    // 2. Local Fallback (Dev Mode / Heavy Server)
    let browser = null;
    let tempDir = '';

    try {
        const body: ExportRequest = await request.json();
        const { shaderCode, aspectRatio = '16:9', quality = 'HD', duration = 5, fps = 30, format = 'mp4', crf: providedCrf } = body;

        if (!shaderCode) {
            return NextResponse.json({ error: 'Shader code is required' }, { status: 400 });
        }

        const { width, height } = getResolution(aspectRatio, quality);
        const totalFrames = Math.floor(duration * fps);

        // Create temp directory for frames
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-render-'));
        const framesDir = path.join(tempDir, 'frames');
        fs.mkdirSync(framesDir);

        console.log(`Starting video export: ${width}x${height}, ${totalFrames} frames`);

        // Launch Puppeteer
        browser = await puppeteer.launch({
            headless: 'shell', // Try 'shell' mode for better GPU support
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--ignore-gpu-blocklist',
                '--enable-gpu', // Explicitly enable GPU
                '--enable-webgl',
            ]
        });

        const page = await browser.newPage();

        // Capture browser console logs
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', (err: any) => console.error('BROWSER ERROR:', err.toString()));
        page.on('requestfailed', request => {
            console.error(`BROWSER REQ FAILED: ${request.url()} - ${request.failure()?.errorText}`);
        });

        await page.setViewport({ width, height });

        // Load the render page
        const renderHtmlPath = path.join(process.cwd(), 'public', 'render.html');
        await page.goto(`file://${renderHtmlPath}`, { waitUntil: 'networkidle0' });

        // Initialize shader
        await page.evaluate((code: string, w: number, h: number) => {
            (window as unknown as { initShader: (w: number, h: number, code: string) => void }).initShader(w, h, code);
        }, shaderCode, width, height);

        // Wait for shader to be ready (compilation can be async-ish or take a frame)
        try {
            await page.waitForFunction('window.isShaderReady === true', { timeout: 5000 });
        } catch (e) {
            console.error('Shader compilation timed out');
            throw new Error('Shader compilation failed on server');
        }

        // Capture frames
        for (let i = 0; i < totalFrames; i++) {
            const time = i / fps;

            await page.evaluate((t: number) => {
                (window as unknown as { setTime: (t: number) => void }).setTime(t);
                (window as unknown as { render: () => void }).render();
            }, time);

            // Capture frames as JPEG for 30-50% speed boost
            const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.jpg`);
            await page.screenshot({ path: framePath, type: 'jpeg', quality: 100 });

            if (i % 10 === 0) {
                console.log(`Captured frame ${i + 1}/${totalFrames}`);
            }
        }

        await browser.close();
        browser = null;

        console.log('All frames captured, encoding video...');

        // Encode with FFmpeg
        const outputPath = path.join(tempDir, `output.${format}`);

        // Determine CRF (Quality) based on resolution
        // Lower CRF = Higher Quality/Bitrate. 
        // User requested 18 for High.
        let crf = providedCrf;
        if (!crf) {
            crf = 18;
            if (quality === '4K') crf = 14; // Legacy fallback
            if (quality === 'FHD') crf = 16; // Legacy fallback
        }

        let ffmpegOutputOptions = [
            '-pix_fmt yuv420p',
            `-crf ${crf}`,
            '-preset fast',
            '-movflags +faststart'
        ];
        let vCodec = 'libx264';

        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(path.join(framesDir, 'frame_%05d.jpg'))
                .inputFPS(fps)
                .output(outputPath)
                .videoCodec(vCodec)
                .outputOptions(ffmpegOutputOptions)
                .on('start', (cmd: string) => console.log('FFmpeg command:', cmd))
                .on('progress', (progress: any) => {
                    if (progress.percent) {
                        console.log(`Encoding: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log('Video encoding complete');
                    resolve();
                })
                .on('error', (err: Error) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .run();
        });

        // Read the output file
        const videoBuffer = fs.readFileSync(outputPath);

        // Cleanup temp files
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Return video
        return new NextResponse(videoBuffer, {
            headers: {
                'Content-Type': `video/${format}`,
                'Content-Disposition': `attachment; filename="ai-art-${Date.now()}.${format}"`,
                'Content-Length': videoBuffer.length.toString()
            }
        });

    } catch (error) {
        console.error('Video export error:', error);

        if (browser) {
            await browser.close();
        }

        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Video export failed' },
            { status: 500 }
        );
    }
}
