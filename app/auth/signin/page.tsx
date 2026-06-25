'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Heart, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    return (
        <div className="min-h-screen bg-portal-background flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-portal-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Heart className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-portal-text">Welcome</h1>
                    <p className="text-portal-muted mt-1">Sign in to your portal</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-800 font-medium">Sign in failed</p>
                            <p className="text-red-600 text-sm">
                                {error === 'OAuthCallback' 
                                    ? 'There was a problem signing you in. Please try again.'
                                    : 'An error occurred during sign in.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Sign In Button */}
                <button
                    onClick={() => signIn('cognito', { callbackUrl })}
                    className="w-full btn-primary py-4 text-lg"
                >
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                </button>

                {/* Help Text */}
                <div className="mt-6 text-center text-sm text-portal-muted">
                    <p>
                        Use the email and temporary password your peer support
                        specialist sent you. You&apos;ll set your own password on
                        first sign-in.
                    </p>
                </div>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <Link href="/" className="text-sm text-portal-muted hover:text-portal-text">
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
}
