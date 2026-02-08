// =============================================================================
// Participant Portal - Type Definitions
// =============================================================================

export interface Participant {
    id: string;
    organization_id: string;
    primary_pss_id?: string;
    first_name: string;
    last_name: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    status: 'active' | 'inactive' | 'discharged';
    created_at: string;
    updated_at: string;
}

export interface Goal {
    id: string;
    user_id: string;
    organization_id?: string;
    participant_id?: string;
    participant_name: string;
    goal_area: string;
    desired_outcome: string;
    motivation_level?: number;
    strengths?: string[];
    challenges?: string[];
    timeframe?: string;
    smart_goal?: string;
    goal_data?: string;
    status?: 'active' | 'in_progress' | 'completed' | 'paused';
    progress?: number;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Conversation {
    id: string;
    organization_id: string;
    type: 'direct' | 'participant' | 'team' | 'announcement';
    participant_id?: string;
    subject?: string;
    category?: string;
    status: 'active' | 'archived' | 'closed';
    last_message_at?: string;
    last_message_preview?: string;
    message_count: number;
    created_at: string;
    updated_at: string;
    // From join
    unread_count?: number;
    last_read_at?: string;
    muted?: boolean;
    pss_user?: {
        id: string;
        name: string;
        avatar_url?: string;
    };
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_type: 'user' | 'participant' | 'system';
    sender_user_id?: string;
    sender_participant_id?: string;
    content: string;
    content_type: 'text' | 'html' | 'markdown';
    status: 'sent' | 'delivered' | 'read' | 'deleted';
    is_edited: boolean;
    created_at: string;
    sender?: {
        id?: string;
        name: string;
        avatar_url?: string;
    };
}

export interface ConversationMember {
    id: string;
    conversation_id: string;
    member_type: 'user' | 'participant';
    user_id?: string;
    participant_id?: string;
    role: 'owner' | 'member' | 'viewer';
    unread_count: number;
    last_read_at?: string;
    muted: boolean;
    is_active: boolean;
}

export interface ParticipantCredentials {
    id: string;
    participant_id: string;
    cognito_sub?: string;
    email: string;
    portal_enabled: boolean;
    status: 'active' | 'suspended' | 'revoked';
    consent_given_at?: string;
    terms_accepted_at?: string;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}
