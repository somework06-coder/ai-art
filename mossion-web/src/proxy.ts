import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from './lib/supabase/server'

export async function middleware(request: NextRequest) {
    // Only apply to /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const supabase = await createClient()

        // 1. Check if user is logged in
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            // Not logged in -> redirect to login (or home)
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // 2. Check if user is an admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_admin) {
            // Logged in but not an admin -> redirect to home
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    // Continue for all other routes
    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
