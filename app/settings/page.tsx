'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
    User, Bell, Shield, HelpCircle, LogOut,
    ChevronRight, Loader2, Phone, Mail, Building2,
    Heart
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    const participant = (session as any)?.participant;
    const displayName = participant?.preferredName || 
                       `${participant?.firstName || ''} ${participant?.lastName || ''}`.trim() ||
                       'Participant';

    function handleLogout() {
        signOut({ callbackUrl: '/' });
    }

    return (
        <div className="min-h-screen bg-portal-background pb-20">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-6 py-4 sticky top-0 z-40 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <h1 className="text-xl font-bold text-portal-text">Settings</h1>
                </div>
            </header>

            <main className="px-6 py-4">
                <div className="max-w-lg mx-auto space-y-6">
                    {/* Profile Section */}
                    <div className="card p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-portal-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-portal-text">{displayName}</h2>
                                <p className="text-sm text-portal-muted">{session.user?.email}</p>
                            </div>
                        </div>

                        {participant?.organizationName && (
                            <div className="flex items-center gap-2 text-sm text-portal-muted pt-4 border-t border-portal-border">
                                <Building2 className="w-4 h-4" />
                                <span>{participant.organizationName}</span>
                            </div>
                        )}

                        {participant?.pssName && (
                            <div className="flex items-center gap-2 text-sm text-portal-muted mt-2">
                                <Heart className="w-4 h-4" />
                                <span>Your PSS: {participant.pssName}</span>
                            </div>
                        )}
                    </div>

                    {/* Settings Menu */}
                    <div className="card divide-y divide-portal-border">
                        <SettingsItem
                            icon={<User className="w-5 h-5" />}
                            label="Profile Information"
                            description="View your profile details"
                            onClick={() => {}}
                        />
                        <SettingsItem
                            icon={<Bell className="w-5 h-5" />}
                            label="Notifications"
                            description="Manage notification preferences"
                            onClick={() => {}}
                            comingSoon
                        />
                        <SettingsItem
                            icon={<Shield className="w-5 h-5" />}
                            label="Privacy & Security"
                            description="Your data is protected"
                            onClick={() => {}}
                            comingSoon
                        />
                    </div>

                    {/* Help Section */}
                    <div className="card divide-y divide-portal-border">
                        <SettingsItem
                            icon={<HelpCircle className="w-5 h-5" />}
                            label="Help & Support"
                            description="Get help using the portal"
                            onClick={() => {}}
                        />
                    </div>

                    {/* Crisis Resources */}
                    <div className="card p-4 bg-red-50 border-red-200">
                        <h3 className="font-semibold text-red-800 mb-2">Crisis Resources</h3>
                        <p className="text-sm text-red-700 mb-3">
                            If you're in crisis, please reach out for help:
                        </p>
                        <div className="space-y-2">
                            <a 
                                href="tel:988" 
                                className="flex items-center gap-2 text-red-700 hover:text-red-800"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium">988</span>
                                <span className="text-sm">- Suicide & Crisis Lifeline</span>
                            </a>
                            <a 
                                href="tel:911" 
                                className="flex items-center gap-2 text-red-700 hover:text-red-800"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium">911</span>
                                <span className="text-sm">- Emergency Services</span>
                            </a>
                        </div>
                    </div>

                    {/* Sign Out */}
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full card p-4 flex items-center justify-center gap-2 text-portal-error hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>

                    {/* Version */}
                    <p className="text-center text-sm text-portal-muted">
                        My Recovery Portal v1.0.0
                    </p>
                </div>
            </main>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
                    <div className="bg-white rounded-xl p-6 max-w-sm w-full animate-slide-up">
                        <h3 className="text-lg font-semibold text-portal-text mb-2">
                            Sign Out?
                        </h3>
                        <p className="text-portal-muted mb-6">
                            Are you sure you want to sign out of your account?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 btn-outline py-3"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 bg-portal-error text-white py-3 rounded-lg font-medium hover:bg-red-600 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
}

function SettingsItem({ 
    icon, 
    label, 
    description, 
    onClick,
    comingSoon = false
}: { 
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    comingSoon?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={comingSoon}
            className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
            <div className="w-10 h-10 bg-portal-primary/10 rounded-lg flex items-center justify-center text-portal-primary">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-portal-text">{label}</p>
                    {comingSoon && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            Coming Soon
                        </span>
                    )}
                </div>
                <p className="text-sm text-portal-muted">{description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-portal-muted" />
        </button>
    );
}
