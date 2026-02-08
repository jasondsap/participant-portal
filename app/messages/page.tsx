'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
    MessageCircle, ChevronRight, Loader2, 
    User, Clock
} from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Conversation } from '@/types';

export default function MessagesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId) {
            fetchConversations();
        }
    }, [session]);

    async function fetchConversations() {
        try {
            const res = await fetch('/api/messages');
            const data = await res.json();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-portal-background">
                <Loader2 className="w-8 h-8 animate-spin text-portal-primary" />
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="min-h-screen bg-portal-background pb-20">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-6 py-4 sticky top-0 z-40 safe-area-top">
                <div className="max-w-lg mx-auto">
                    <h1 className="text-xl font-bold text-portal-text">Messages</h1>
                    <p className="text-sm text-portal-muted">
                        Chat with your peer support specialist
                    </p>
                </div>
            </header>

            <main className="px-6 py-4">
                <div className="max-w-lg mx-auto">
                    {conversations.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-portal-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageCircle className="w-8 h-8 text-portal-primary" />
                            </div>
                            <h2 className="text-lg font-semibold text-portal-text mb-2">
                                No Messages Yet
                            </h2>
                            <p className="text-portal-muted">
                                Your peer support specialist will reach out to you soon.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {conversations.map((conversation) => (
                                <ConversationCard 
                                    key={conversation.id} 
                                    conversation={conversation} 
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}

function ConversationCard({ conversation }: { conversation: Conversation }) {
    const pssName = conversation.pss_user?.name || 'Your PSS';
    const hasUnread = (conversation.unread_count || 0) > 0;
    
    function formatTime(dateString?: string) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return (
        <Link href={`/messages/${conversation.id}`}>
            <div className={`card-hover p-4 flex items-center gap-4 ${hasUnread ? 'bg-portal-primary/5' : ''}`}>
                {/* Avatar */}
                <div className="w-12 h-12 bg-portal-primary rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                    {pssName.charAt(0).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold truncate ${hasUnread ? 'text-portal-text' : 'text-portal-text'}`}>
                            {pssName}
                        </h3>
                        <span className="text-xs text-portal-muted flex-shrink-0 ml-2">
                            {formatTime(conversation.last_message_at)}
                        </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${hasUnread ? 'text-portal-text font-medium' : 'text-portal-muted'}`}>
                            {conversation.last_message_preview || 'No messages yet'}
                        </p>
                        
                        {hasUnread && (
                            <span className="w-5 h-5 bg-portal-primary text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                {conversation.unread_count! > 9 ? '9+' : conversation.unread_count}
                            </span>
                        )}
                    </div>
                </div>

                <ChevronRight className="w-5 h-5 text-portal-muted flex-shrink-0" />
            </div>
        </Link>
    );
}
