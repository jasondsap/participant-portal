'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
    ArrowLeft, Send, Loader2, AlertTriangle,
    Check, CheckCheck, Clock, Smile, SmilePlus
} from 'lucide-react';
import { Message } from '@/types';
import { QUICK_REACTIONS, EMOJI_GROUPS } from '@/lib/emoji';
import type { ReactionGroup } from '@/lib/reactions';

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
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    function insertEmoji(emoji: string) {
        setNewMessage((prev) => prev + emoji);
        setShowEmojiPicker(false);
        textareaRef.current?.focus();
    }

    async function toggleReaction(messageId: string, emoji: string) {
        setReactingMsgId(null);
        // Optimistic: flip locally, then reconcile with the server response.
        setMessages((prev) => prev.map((m) => {
            if (m.id !== messageId) return m;
            const current: ReactionGroup[] = ((m as any).reactions || []).slice();
            const idx = current.findIndex((r) => r.emoji === emoji);
            let next: ReactionGroup[];
            if (idx >= 0 && current[idx].mine) {
                const updated = { ...current[idx], count: current[idx].count - 1, mine: false };
                next = updated.count > 0 ? current.map((r, i) => (i === idx ? updated : r)) : current.filter((_, i) => i !== idx);
            } else if (idx >= 0) {
                next = current.map((r, i) => (i === idx ? { ...r, count: r.count + 1, mine: true } : r));
            } else {
                next = [...current, { emoji, count: 1, mine: true, users: ['You'] }];
            }
            return { ...m, reactions: next } as Message;
        }));
        try {
            const res = await fetch(`/api/messages/${conversationId}/reactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: messageId, emoji }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages((prev) => prev.map((m) => (m.id === messageId ? ({ ...m, reactions: data.reactions } as Message) : m)));
            }
        } catch (e) {
            console.error('Failed to react:', e);
        }
    }

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
                                            
                                            <div className={`relative flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                                <div className={isOwn ? 'message-bubble-sent' : 'message-bubble-received'}>
                                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                                </div>
                                                {!String(message.id).startsWith('temp-') && message.sender_type !== 'system' && (
                                                    <button
                                                        onClick={() => setReactingMsgId(reactingMsgId === message.id ? null : message.id)}
                                                        className="p-1 text-portal-muted hover:text-portal-primary"
                                                        aria-label="React"
                                                    >
                                                        <SmilePlus className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {reactingMsgId === message.id && (
                                                    <div className={`absolute z-20 -top-10 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-0.5 bg-white border border-portal-border rounded-full shadow-md px-1.5 py-1`}>
                                                        {QUICK_REACTIONS.map((e) => (
                                                            <button key={e} onClick={() => toggleReaction(message.id, e)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-base leading-none">
                                                                {e}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {Array.isArray((message as any).reactions) && (message as any).reactions.length > 0 && (
                                                <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                                                    {((message as any).reactions as ReactionGroup[]).map((r) => (
                                                        <button key={r.emoji} onClick={() => toggleReaction(message.id, r.emoji)}
                                                            title={r.users.join(', ')}
                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-colors ${
                                                                r.mine
                                                                    ? 'bg-portal-primary/10 border-portal-primary text-portal-primary'
                                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                            }`}>
                                                            <span className="text-sm leading-none">{r.emoji}</span>
                                                            <span className="font-medium">{r.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

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
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={() => setShowEmojiPicker((s) => !s)}
                            aria-label="Insert emoji"
                            className="p-3 text-portal-muted hover:text-portal-secondary rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-portal-border rounded-xl shadow-xl z-30 p-3 max-h-72 overflow-y-auto">
                                {EMOJI_GROUPS.map((g) => (
                                    <div key={g.label} className="mb-2 last:mb-0">
                                        <p className="text-[11px] font-semibold text-portal-muted uppercase tracking-wider mb-1">{g.label}</p>
                                        <div className="grid grid-cols-8 gap-0.5">
                                            {g.emojis.map((e) => (
                                                <button key={e} onClick={() => insertEmoji(e)}
                                                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-lg leading-none">
                                                    {e}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
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
