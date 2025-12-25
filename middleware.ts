// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost ?? req.headers.get('host') ?? '';
  const host = hostHeader.split(',')[0].trim();
  const hostname = host.split(':')[0];
  console.log('[Middleware] Host:', host, 'Path:', req.nextUrl.pathname);

  if (hostname === 'taam.menu' || hostname === 'www.taam.menu') return NextResponse.next();

  if (hostname.endsWith('.taam.menu')) {
    const subdomain = hostname.split('.')[0];
    const url = req.nextUrl.clone();
    if (url.pathname === '/') url.pathname = `/${subdomain}`;
    else url.pathname = `/${subdomain}${url.pathname}`;

    console.log('[Middleware] Rewriting to:', url.pathname);

    const res = NextResponse.rewrite(url);
    res.headers.set('x-rewritten-path', url.pathname);
    return res;
  }

  return NextResponse.next();
}

// Применяем middleware ко всем путям кроме статики Next.js
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
