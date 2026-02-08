'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { 
    ArrowLeft, Send, Loader2, AlertTriangle,
    Check, CheckCheck, Clock
} from 'lucide-react';
import { Message } from '@/types';

export default function ConversationPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const conversationId = params.conversationId as string;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [pssName, setPssName] = useState('Your PSS');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.participantId && conversationId) {
            fetchMessages();
            markAsRead();
        }
    }, [session, conversationId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [newMessage]);

    async function fetchMessages() {
        try {
            const res = await fetch(`/api/messages/${conversationId}`);
            const data = await res.json();
            setMessages(data.messages || []);
            if (data.pss_user?.name) {
                setPssName(data.pss_user.name);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    }

    async function markAsRead() {
        try {
            await fetch(`/api/messages/${conversationId}/read`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }

    async function handleSend() {
        if (!newMessage.trim() || sending) return;

        const content = newMessage.trim();
        setNewMessage('');
        setSending(true);

        // Optimistic update
        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            conversation_id: conversationId,
            sender_type: 'participant',
            sender_participant_id: (session as any)?.participantId,
            content,
            content_type: 'text',
            status: 'sent',
            is_edited: false,
            created_at: new Date().toISOString(),
            sender: {
                id: (session as any)?.participantId,
                name: 'You'
            }
        };
        setMessages(prev => [...prev, tempMessage]);

        try {
            const res = await fetch(`/api/messages/${conversationId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            const data = await res.json();
            
            if (data.success && data.message) {
                setMessages(prev => 
                    prev.map(m => m.id === tempMessage.id ? data.message : m)
                );
            } else {
                setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
                console.error('Failed to send message:', data.error);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        } finally {
            setSending(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
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

    const participantId = (session as any)?.participantId;

    return (
        <div className="min-h-screen bg-portal-background flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-portal-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40 safe-area-top">
                <button
                    onClick={() => router.push('/messages')}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
                >
                    <ArrowLeft className="w-5 h-5 text-portal-text" />
                </button>
                
                <div className="w-10 h-10 bg-portal-primary rounded-full flex items-center justify-center text-white font-medium">
                    {pssName.charAt(0).toUpperCase()}
                </div>
                
                <div>
                    <h1 className="font-semibold text-portal-text">{pssName}</h1>
                    <p className="text-xs text-portal-muted">Peer Support Specialist</p>
                </div>
            </header>

            {/* Crisis Banner */}
            <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                    If you're in crisis, call <strong>988</strong> or <strong>911</strong>
                </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-portal-muted py-8">
                        <p>No messages yet</p>
                        <p className="text-sm mt-1">Send a message to start the conversation</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => {
                            const isOwn = message.sender_type === 'participant' && 
                                         message.sender_participant_id === participantId;
                            const showDateDivider = shouldShowDateDivider(message, messages[index - 1]);

                            return (
                                <div key={message.id}>
                                    {showDateDivider && (
                                        <div className="flex justify-center my-4">
                                            <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                                {formatDateDivider(message.created_at)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] ${isOwn ? 'order-2' : ''}`}>
                                            {!isOwn && message.sender_type !== 'system' && (
                                                <p className="text-xs text-portal-muted mb-1 ml-1">
                                                    {message.sender?.name}
                                                </p>
                                            )}
                                            
                                            <div className={isOwn ? 'message-bubble-sent' : 'message-bubble-received'}>
                                                <p className="whitespace-pre-wrap">{message.content}</p>
                                            </div>
                                            
                                            <div className={`flex items-center gap-1 mt-1 text-xs text-portal-muted ${
                                                isOwn ? 'justify-end mr-1' : 'ml-1'
                                            }`}>
                                                <span>{formatTime(message.created_at)}</span>
                                                {isOwn && (
                                                    message.status === 'read' ? (
                                                        <CheckCheck className="w-3 h-3 text-portal-primary" />
                                                    ) : (
                                                        <Check className="w-3 h-3" />
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Compose Area */}
            <div className="bg-white border-t border-portal-border p-4 safe-area-bottom">
                <div className="flex items-end gap-2 max-w-lg mx-auto">
                    <div className="flex-1">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="w-full px-4 py-3 border border-portal-border rounded-2xl resize-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
                        />
                    </div>
                    
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-portal-primary text-white rounded-full hover:bg-portal-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Helper functions
function shouldShowDateDivider(current: Message, previous?: Message): boolean {
    if (!previous) return true;
    const currentDate = new Date(current.created_at).toDateString();
    const prevDate = new Date(previous.created_at).toDateString();
    return currentDate !== prevDate;
}

function formatDateDivider(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}
