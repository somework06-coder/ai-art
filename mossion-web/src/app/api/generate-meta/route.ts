import { NextResponse } from 'next/server';
import { authenticateRequest, checkRateLimit } from '@/lib/rateLimit';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function POST(req: Request) {
    try {
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server' }, { status: 500 });
        }

        // 1. Authenticate Request
        const authHeader = req.headers.get('Authorization');
        const { user, error } = await authenticateRequest(authHeader);

        // TEMPORARY: Allow unauthenticated fallback for testing
        // if (error || !user) {
        //   return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
        // }

        const ip = req.headers.get('x-forwarded-for') || 'anonymous';
        const identifier = user ? user.id : ip;

        // 2. Check Rate Limit (Separate bucket from shader generation, or same? We'll use the same identifier)
        const { allowed, remaining } = await checkRateLimit(identifier);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again in a minute.', remaining },
                { status: 429 }
            );
        }

        // 3. Forward to Gemini
        const body = await req.json();

        const response = await fetch(`${GEMINI_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
            headers: {
                'X-RateLimit-Limit': '20',
                'X-RateLimit-Remaining': remaining.toString(),
            }
        });

    } catch (error: any) {
        console.error('API /generate-meta error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
