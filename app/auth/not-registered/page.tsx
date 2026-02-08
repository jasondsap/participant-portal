'use client';

import Link from 'next/link';
import { UserX, ArrowLeft, MessageCircle } from 'lucide-react';

export default function NotRegisteredPage() {
    return (
        <div className="min-h-screen bg-portal-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm text-center">
                {/* Icon */}
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserX className="w-8 h-8 text-amber-600" />
                </div>

                {/* Message */}
                <h1 className="text-2xl font-bold text-portal-text mb-2">
                    Account Not Found
                </h1>
                <p className="text-portal-muted mb-6">
                    Your email is not registered in our system. You need to be invited by your 
                    peer support specialist to access the portal.
                </p>

                {/* Info Box */}
                <div className="bg-white rounded-lg border border-portal-border p-4 mb-8 text-left">
                    <h3 className="font-semibold text-portal-text mb-2 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-portal-primary" />
                        How to get access
                    </h3>
                    <ol className="text-sm text-portal-muted space-y-2">
                        <li>1. Contact your peer support specialist</li>
                        <li>2. Ask them to invite you to the portal</li>
                        <li>3. Check your email for an invitation</li>
                        <li>4. Come back and sign in!</li>
                    </ol>
                </div>

                {/* Back Button */}
                <Link 
                    href="/" 
                    className="inline-flex items-center gap-2 text-portal-primary hover:underline"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
