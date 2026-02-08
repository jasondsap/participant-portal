-- =============================================================================
-- Participant Portal - Database Setup
-- Run this in Neon if you haven't already run the messaging system migration
-- =============================================================================

-- Check if participant_credentials table exists (from messaging migration)
-- If not, create it:

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'participant_credentials') THEN
        CREATE TABLE participant_credentials (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            cognito_sub VARCHAR(255) UNIQUE,
            email VARCHAR(255) NOT NULL,
            portal_enabled BOOLEAN DEFAULT false,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
            consent_given_at TIMESTAMPTZ,
            terms_accepted_at TIMESTAMPTZ,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX idx_participant_credentials_participant ON participant_credentials(participant_id);
        CREATE INDEX idx_participant_credentials_email ON participant_credentials(email);
        CREATE INDEX idx_participant_credentials_cognito_sub ON participant_credentials(cognito_sub);
    END IF;
END $$;

-- =============================================================================
-- Helper function to enable portal access for a participant
-- =============================================================================

CREATE OR REPLACE FUNCTION enable_participant_portal(
    p_participant_id UUID,
    p_email VARCHAR(255)
) RETURNS UUID AS $$
DECLARE
    v_credential_id UUID;
BEGIN
    -- Check if credentials already exist
    SELECT id INTO v_credential_id
    FROM participant_credentials
    WHERE participant_id = p_participant_id;
    
    IF v_credential_id IS NOT NULL THEN
        -- Update existing
        UPDATE participant_credentials
        SET 
            email = p_email,
            portal_enabled = true,
            status = 'active',
            updated_at = NOW()
        WHERE id = v_credential_id;
        
        RETURN v_credential_id;
    ELSE
        -- Create new
        INSERT INTO participant_credentials (participant_id, email, portal_enabled, status)
        VALUES (p_participant_id, p_email, true, 'active')
        RETURNING id INTO v_credential_id;
        
        RETURN v_credential_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Helper function to disable portal access
-- =============================================================================

CREATE OR REPLACE FUNCTION disable_participant_portal(
    p_participant_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE participant_credentials
    SET 
        portal_enabled = false,
        updated_at = NOW()
    WHERE participant_id = p_participant_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Example: Enable portal for a participant
-- =============================================================================
-- 
-- SELECT enable_participant_portal(
--     'participant-uuid-here',
--     'participant@email.com'
-- );
--
-- =============================================================================
