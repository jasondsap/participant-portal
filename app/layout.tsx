import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'My Recovery Portal',
    description: 'Your personal recovery support portal - stay connected with your peer support specialist',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'My Recovery Portal',
    },
    formatDetection: {
        telephone: true,
    },
    openGraph: {
        type: 'website',
        title: 'My Recovery Portal',
        description: 'Your personal recovery support portal',
        siteName: 'My Recovery Portal',
    },
};

export const viewport: Viewport = {
    themeColor: '#5B7C99',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/icons/icon-192.png" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" href="/icon-180.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
            </head>
            <body className={inter.className}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
