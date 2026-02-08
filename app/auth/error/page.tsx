'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Heart } from 'lucide-react';

export default function AuthErrorPage() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');

    const errorMessages: Record<string, { title: string; message: string }> = {
        Configuration: {
            title: 'Configuration Error',
            message: 'There is a problem with the server configuration. Please contact support.'
        },
        AccessDenied: {
            title: 'Access Denied',
            message: 'You do not have permission to sign in. Please contact your peer support specialist.'
        },
        Verification: {
            title: 'Verification Error',
            message: 'The verification link may have expired. Please try signing in again.'
        },
        OAuthCallback: {
            title: 'Sign In Error',
            message: 'There was a problem completing your sign in. Please try again.'
        },
        default: {
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred. Please try again later.'
        }
    };

    const { title, message } = errorMessages[error || 'default'] || errorMessages.default;

    return (
        <div className="min-h-screen bg-portal-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm text-center">
                {/* Icon */}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>

                {/* Error Message */}
                <h1 className="text-2xl font-bold text-portal-text mb-2">{title}</h1>
                <p className="text-portal-muted mb-8">{message}</p>

                {/* Actions */}
                <div className="space-y-3">
                    <Link href="/auth/signin" className="block w-full btn-primary py-3">
                        Try Again
                    </Link>
                    <Link 
                        href="/" 
                        className="block w-full btn-outline py-3"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>

                {/* Help */}
                <div className="mt-8 p-4 bg-white rounded-lg border border-portal-border">
                    <p className="text-sm text-portal-muted">
                        If you continue to have problems, please contact your peer support specialist 
                        or call the support line.
                    </p>
                </div>
            </div>
        </div>
    );
}
