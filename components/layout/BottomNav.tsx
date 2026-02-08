'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageCircle, Target, Settings } from 'lucide-react';

const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home' },
    { href: '/messages', icon: MessageCircle, label: 'Messages' },
    { href: '/goals', icon: Target, label: 'Goals' },
    { href: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-portal-border safe-area-bottom z-50">
            <div className="max-w-lg mx-auto flex items-center justify-around py-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || 
                                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                                isActive 
                                    ? 'text-portal-primary' 
                                    : 'text-portal-muted hover:text-portal-text'
                            }`}
                        >
                            <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
