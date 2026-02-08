import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Re-export authOptions
export { authOptions };

// Extended session type for participants
export interface ParticipantSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    participantId: string;
    organizationId: string;
    participantName: string;
    participant?: {
        id: string;
        firstName: string;
        lastName: string;
        preferredName?: string;
        organizationName: string;
        pssName?: string;
    };
    expires: string;
}

/**
 * Get the current session on the server
 */
export async function getSession(): Promise<ParticipantSession | null> {
    return await getServerSession(authOptions) as ParticipantSession | null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<ParticipantSession> {
    const session = await getSession();
    if (!session?.user?.id || !session?.participantId) {
        throw new Error("Unauthorized");
    }
    return session;
}

/**
 * Get participant ID from session
 */
export async function getParticipantId(): Promise<string> {
    const session = await requireAuth();
    return session.participantId;
}

/**
 * Get organization ID from session
 */
export async function getOrganizationId(): Promise<string> {
    const session = await requireAuth();
    return session.organizationId;
}

// Type augmentation for NextAuth
declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
        participantId?: string;
        organizationId?: string;
        participantName?: string;
        participant?: {
            id: string;
            firstName: string;
            lastName: string;
            preferredName?: string;
            organizationName: string;
            pssName?: string;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        sub: string;
        accessToken?: string;
        participantId?: string;
        organizationId?: string;
        participantName?: string;
    }
}
