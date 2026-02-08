import { neon } from '@neondatabase/serverless';

// Create SQL query function
export const sql = neon(process.env.DATABASE_URL!);

// ==================== QUERY HELPERS ====================

/**
 * Execute a parameterized query
 */
export async function query<T>(queryString: string, params?: unknown[]): Promise<T[]> {
    try {
        const result = await sql(queryString, params);
        return result as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Get a single record or null
 */
export async function queryOne<T>(queryString: string, params?: unknown[]): Promise<T | null> {
    const results = await query<T>(queryString, params);
    return results[0] || null;
}

// ==================== PARTICIPANT HELPERS ====================

/**
 * Get or create participant credentials for portal access
 */
export async function getOrCreateParticipantCredentials(
    cognitoSub: string, 
    email: string, 
    name?: string
) {
    // First check if participant credentials exist
    const existing = await sql`
        SELECT pc.*, p.first_name, p.last_name, p.preferred_name, p.organization_id
        FROM participant_credentials pc
        JOIN participants p ON pc.participant_id = p.id
        WHERE pc.cognito_sub = ${cognitoSub}
        AND pc.status = 'active'
    `;
    
    if (existing.length > 0) {
        // Update last login
        await sql`
            UPDATE participant_credentials 
            SET last_login_at = NOW() 
            WHERE cognito_sub = ${cognitoSub}
        `;
        return existing[0];
    }
    
    // Try to find by email (participant may have been invited but not yet logged in)
    const byEmail = await sql`
        SELECT pc.*, p.first_name, p.last_name, p.preferred_name, p.organization_id
        FROM participant_credentials pc
        JOIN participants p ON pc.participant_id = p.id
        WHERE pc.email = ${email}
        AND pc.status = 'active'
    `;
    
    if (byEmail.length > 0) {
        // Link the cognito_sub
        await sql`
            UPDATE participant_credentials 
            SET cognito_sub = ${cognitoSub}, last_login_at = NOW()
            WHERE id = ${byEmail[0].id}
        `;
        return byEmail[0];
    }
    
    // No credentials found - participant must be invited by staff first
    return null;
}

/**
 * Get participant by ID with organization info
 */
export async function getParticipantById(participantId: string) {
    const result = await sql`
        SELECT 
            p.*,
            o.name as organization_name,
            o.logo_url as organization_logo,
            u.first_name || ' ' || u.last_name as pss_name,
            u.email as pss_email
        FROM participants p
        JOIN organizations o ON p.organization_id = o.id
        LEFT JOIN users u ON p.primary_pss_id = u.id
        WHERE p.id = ${participantId}
    `;
    return result[0] || null;
}

/**
 * Get participant's goals
 */
export async function getParticipantGoals(participantId: string, status?: 'active' | 'completed' | 'all') {
    if (status === 'completed') {
        return sql`
            SELECT * FROM saved_goals 
            WHERE participant_id = ${participantId}
            AND status = 'completed'
            ORDER BY completed_at DESC
        `;
    } else if (status === 'active') {
        return sql`
            SELECT * FROM saved_goals 
            WHERE participant_id = ${participantId}
            AND status != 'completed'
            ORDER BY created_at DESC
        `;
    }
    
    // All goals
    return sql`
        SELECT * FROM saved_goals 
        WHERE participant_id = ${participantId}
        ORDER BY 
            CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
            created_at DESC
    `;
}

/**
 * Get participant's conversations
 */
export async function getParticipantConversations(participantId: string) {
    return sql`
        SELECT 
            c.*,
            cm.unread_count,
            cm.last_read_at,
            cm.muted,
            -- Get the PSS user info
            (
                SELECT json_build_object(
                    'id', u.id,
                    'name', u.first_name || ' ' || u.last_name,
                    'avatar_url', u.avatar_url
                )
                FROM conversation_members cm2
                JOIN users u ON cm2.user_id = u.id
                WHERE cm2.conversation_id = c.id
                AND cm2.member_type = 'user'
                LIMIT 1
            ) as pss_user
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE cm.participant_id = ${participantId}
        AND cm.is_active = true
        AND c.status = 'active'
        ORDER BY c.last_message_at DESC NULLS LAST
    `;
}

/**
 * Get messages in a conversation (for participant)
 */
export async function getConversationMessages(conversationId: string, participantId: string, limit = 50) {
    // First verify participant is a member
    const membership = await sql`
        SELECT id FROM conversation_members
        WHERE conversation_id = ${conversationId}
        AND participant_id = ${participantId}
        AND is_active = true
    `;
    
    if (membership.length === 0) {
        throw new Error('Not a member of this conversation');
    }
    
    // Get messages
    const messages = await sql`
        SELECT 
            m.id,
            m.conversation_id,
            m.sender_type,
            m.sender_user_id,
            m.sender_participant_id,
            m.content,
            m.content_type,
            m.status,
            m.is_edited,
            m.created_at,
            CASE 
                WHEN m.sender_type = 'user' THEN json_build_object(
                    'id', u.id,
                    'name', u.first_name || ' ' || u.last_name,
                    'avatar_url', u.avatar_url
                )
                WHEN m.sender_type = 'participant' THEN json_build_object(
                    'id', p.id,
                    'name', COALESCE(p.preferred_name, p.first_name) || ' ' || p.last_name,
                    'avatar_url', null
                )
                ELSE json_build_object('name', 'System')
            END as sender
        FROM messages m
        LEFT JOIN users u ON m.sender_user_id = u.id
        LEFT JOIN participants p ON m.sender_participant_id = p.id
        WHERE m.conversation_id = ${conversationId}
        AND m.status != 'deleted'
        ORDER BY m.created_at ASC
        LIMIT ${limit}
    `;
    
    return messages;
}

/**
 * Send a message as participant
 */
export async function sendParticipantMessage(
    conversationId: string, 
    participantId: string, 
    content: string
) {
    // Verify membership
    const membership = await sql`
        SELECT id FROM conversation_members
        WHERE conversation_id = ${conversationId}
        AND participant_id = ${participantId}
        AND is_active = true
    `;
    
    if (membership.length === 0) {
        throw new Error('Not a member of this conversation');
    }
    
    // Insert message
    const message = await sql`
        INSERT INTO messages (
            conversation_id,
            sender_type,
            sender_participant_id,
            content,
            content_type
        )
        VALUES (
            ${conversationId},
            'participant',
            ${participantId},
            ${content},
            'text'
        )
        RETURNING *
    `;
    
    // Update sender's read status
    await sql`
        UPDATE conversation_members
        SET unread_count = 0, last_read_at = NOW()
        WHERE conversation_id = ${conversationId}
        AND participant_id = ${participantId}
    `;
    
    return message[0];
}

/**
 * Mark conversation as read for participant
 */
export async function markConversationRead(conversationId: string, participantId: string) {
    return sql`
        UPDATE conversation_members
        SET unread_count = 0, last_read_at = NOW()
        WHERE conversation_id = ${conversationId}
        AND participant_id = ${participantId}
    `;
}

// ==================== VALIDATION HELPERS ====================

export function validateUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
