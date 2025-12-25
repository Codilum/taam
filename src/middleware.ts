// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost ?? req.headers.get('host') ?? '';
  const host = hostHeader.split(',')[0].trim();
  const hostname = host.split(':')[0];
  const url = req.nextUrl.clone();

  console.log(`[Middleware] Host: ${host} Path: ${url.pathname}`);

  if (hostname === 'taam.menu' || hostname === 'www.taam.menu') return NextResponse.next();

  if (hostname.endsWith('.taam.menu')) {
    const subdomain = hostname.split('.')[0];
    if (url.pathname === '/') url.pathname = `/${subdomain}`;
    // если нужны вложенные пути, оставим их
    else url.pathname = `/${subdomain}${url.pathname}`;

    const res = NextResponse.rewrite(url);
    console.log(`[Middleware] Rewriting to: ${url.pathname}`);
    return res;
  }

  return NextResponse.next();
}


// Применяем middleware ко всем путям кроме статики Next.js
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
