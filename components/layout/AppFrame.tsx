'use client';

// The frame around every signed-in portal page. The portal was built for
// phones: one narrow column and a tab bar along the bottom. This keeps that
// exactly as it is on a phone or tablet, and on a computer-sized window
// (Tailwind `lg`, 1024px and wider) swaps the bottom bar for a menu down the
// left side and gives the page the remaining width.
//
// Nothing here sniffs the device. The layout follows the width of the window,
// so a tablet turned sideways or a small laptop window each get the layout
// that fits.
//
// Pages still render <BottomNav /> themselves; it hides itself at `lg`.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BookHeart, Calendar, ClipboardCheck, Home, MessageCircle, MessagesSquare, Settings, Target } from 'lucide-react';

// Screens that keep the whole window: the public landing page, sign-in, and a video call in progress.
const BARE = ['/auth', '/telehealth'];
const isBare = (pathname: string | null) => !pathname || pathname === '/' || BARE.some(p => pathname.startsWith(p));

const ITEMS = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/messages', icon: MessageCircle, label: 'Messages' },
    { href: '/sessions', icon: Calendar, label: 'Sessions' },
    { href: '/goals', icon: Target, label: 'My Goals' },
    { href: '/assessments', icon: ClipboardCheck, label: 'Assessments' },
    { href: '/journal', icon: BookHeart, label: 'Journal' },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [interview, setInterview] = useState(false);
    const framed = status === 'authenticated' && !isBare(pathname);

    // Interview practice is offered by some organizations only; ask once.
    useEffect(() => {
        if (!framed) return;
        let off = false;
        fetch('/api/interview-practice').then(r => (r.ok ? r.json() : null)).then(d => { if (!off) setInterview(!!d?.enabled); }).catch(() => { /* the item simply does not show */ });
        return () => { off = true; };
    }, [framed]);

    if (!framed) return <>{children}</>;

    const items = [...ITEMS, ...(interview ? [{ href: '/interview-practice', icon: MessagesSquare, label: 'Interview practice' }] : []), { href: '/settings', icon: Settings, label: 'Settings' }];
    const active = (href: string) => pathname === href || (href !== '/dashboard' && !!pathname?.startsWith(href));
    const name = (session as any)?.participant?.preferredName || (session as any)?.participant?.firstName || (session as any)?.participantName || '';
    const org = (session as any)?.participant?.organizationName || '';

    return (
        <>
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-portal-border z-40" aria-label="Main menu">
                <div className="px-6 py-5 border-b border-portal-border">
                    <p className="text-lg font-bold text-portal-text">My Recovery Portal</p>
                    {(name || org) && <p className="text-sm text-portal-muted truncate">{[name, org].filter(Boolean).join(' · ')}</p>}
                </div>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {items.map(item => (
                        <Link key={item.href} href={item.href} aria-current={active(item.href) ? 'page' : undefined}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active(item.href) ? 'bg-portal-primary/10 text-portal-primary' : 'text-portal-muted hover:bg-gray-50 hover:text-portal-text'}`}>
                            <item.icon className={`w-5 h-5 ${active(item.href) ? 'stroke-[2.5]' : ''}`} aria-hidden="true" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <div className="lg:pl-64">{children}</div>
        </>
    );
}
