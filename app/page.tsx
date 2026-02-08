'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Heart, MessageCircle, Target, Shield, ArrowRight, Loader2, BookHeart, Activity, Calendar } from 'lucide-react';

export default function LandingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (session) {
            router.push('/dashboard');
        }
    }, [session, router]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (session) {
        return null; // Will redirect
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-portal-background to-white">
            {/* Header */}
            <header className="px-6 py-4">
                <div className="max-w-lg mx-auto flex items-center gap-2">
                    <div className="w-10 h-10 bg-portal-primary rounded-xl flex items-center justify-center">
                        <Heart className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-semibold text-portal-text">My Recovery Portal</span>
                </div>
            </header>

            {/* Hero Section */}
            <main className="px-6 py-12">
                <div className="max-w-lg mx-auto text-center">
                    <h1 className="text-3xl font-bold text-portal-text mb-4">
                        Your Recovery Journey,<br />
                        <span className="text-portal-primary">Connected</span>
                    </h1>
                    
                    <p className="text-portal-muted mb-8">
                        Stay connected with your peer support specialist, track your goals, 
                        and take control of your recovery journey.
                    </p>

                    <button
                        onClick={() => signIn('cognito', { callbackUrl: '/dashboard' })}
                        className="w-full btn-primary py-4 text-lg mb-4"
                    >
                        Sign In/Create Account
                        <ArrowRight className="w-5 h-5" />
                    </button>

                    
                </div>

                {/* Features */}
                <div className="max-w-lg mx-auto mt-16 space-y-4">
                    <FeatureCard
                        icon={<MessageCircle className="w-6 h-6" />}
                        title="Secure Messaging"
                        description="Message your peer support specialist anytime, anywhere"
                    />
                    <FeatureCard
                        icon={<Target className="w-6 h-6" />}
                        title="Track Your Goals"
                        description="See your progress and celebrate your achievements"
                    />
                    <FeatureCard
                        icon={<Calendar className="w-6 h-6" />}
                        title="Upcoming Sessions"
                        description="View your scheduled sessions and stay on track"
                    />
                    <FeatureCard
                        icon={<Activity className="w-6 h-6" />}
                        title="Recovery Assessments"
                        description="Complete assessments and track your recovery capital over time"
                    />
                    <FeatureCard
                        icon={<BookHeart className="w-6 h-6" />}
                        title="Personal Journal"
                        description="Reflect on your journey with mood tracking and optional sharing"
                    />
                    <FeatureCard
                        icon={<Shield className="w-6 h-6" />}
                        title="Private & Secure"
                        description="Your information is protected and confidential"
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="px-6 py-8 text-center text-sm text-portal-muted">
                <p>Powered by Peer Support Studio</p>
                <p className="mt-1">&copy; {new Date().getFullYear()} MADe180. All rights reserved.</p>
            </footer>
        </div>
    );
}

function FeatureCard({ 
    icon, 
    title, 
    description 
}: { 
    icon: React.ReactNode; 
    title: string; 
    description: string; 
}) {
    return (
        <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-portal-border">
            <div className="w-12 h-12 bg-portal-primary/10 rounded-lg flex items-center justify-center text-portal-primary flex-shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="font-semibold text-portal-text">{title}</h3>
                <p className="text-sm text-portal-muted">{description}</p>
            </div>
        </div>
    );
}
