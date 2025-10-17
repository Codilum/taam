// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const url = req.nextUrl.clone();

  console.log(`[Middleware] Host: ${host} Path: ${url.pathname}`);

  if (host === 'taam.menu') return NextResponse.next();

  if (host.endsWith('.taam.menu')) {
    const subdomain = host.split('.')[0];
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
