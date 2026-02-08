// =============================================================================
// Participant Portal - Auth Configuration
// =============================================================================

import type { NextAuthOptions } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";
import { getOrCreateParticipantCredentials, getParticipantById } from "@/lib/db";

export const authOptions: NextAuthOptions = {
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER!,
            checks: ["pkce", "state"],
            authorization: {
                params: {
                    scope: "openid email profile"
                }
            }
        }),
    ],

    secret: process.env.NEXTAUTH_SECRET,

    session: {
        strategy: "jwt",
        // 24 hours for participants (more convenient for mobile)
        maxAge: 24 * 60 * 60,
    },

    callbacks: {
        /**
         * Verify participant has portal access on sign-in
         */
        async signIn({ user, account }) {
            try {
                if (account?.provider === "cognito") {
                    const cognitoSub = account.providerAccountId;
                    const email = user.email ?? null;
                    const name = user.name ?? undefined;

                    if (!email) {
                        console.error("Participant signIn: email missing");
                        return false;
                    }

                    // Check if participant has portal credentials
                    const credentials = await getOrCreateParticipantCredentials(
                        cognitoSub, 
                        email, 
                        name
                    );

                    if (!credentials) {
                        // Participant not found - they need to be invited first
                        console.warn("Participant not found in database:", email);
                        return "/auth/not-registered";
                    }

                    // Check if portal access is enabled
                    if (!credentials.portal_enabled) {
                        console.warn("Participant portal access disabled:", email);
                        return "/auth/access-disabled";
                    }

                    return true;
                }
                return true;
            } catch (err) {
                console.error("signIn callback error:", err);
                return "/auth/error";
            }
        },

        /**
         * Store participant info in JWT
         */
        async jwt({ token, account }) {
            if (account?.provider === "cognito") {
                token.sub = account.providerAccountId;
                (token as any).accessToken = account.access_token;
                
                // Get participant info
                try {
                    const credentials = await getOrCreateParticipantCredentials(
                        account.providerAccountId,
                        token.email as string
                    );
                    
                    if (credentials) {
                        (token as any).participantId = credentials.participant_id;
                        (token as any).organizationId = credentials.organization_id;
                        (token as any).participantName = credentials.preferred_name || 
                            `${credentials.first_name} ${credentials.last_name}`.trim();
                    }
                } catch (err) {
                    console.error("jwt callback error:", err);
                }
            }

            return token;
        },

        /**
         * Expose participant info in session
         */
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string;
                (session as any).participantId = (token as any).participantId;
                (session as any).organizationId = (token as any).organizationId;
                (session as any).participantName = (token as any).participantName;
                
                // Get full participant info if needed
                if ((token as any).participantId) {
                    try {
                        const participant = await getParticipantById((token as any).participantId);
                        if (participant) {
                            (session as any).participant = {
                                id: participant.id,
                                firstName: participant.first_name,
                                lastName: participant.last_name,
                                preferredName: participant.preferred_name,
                                organizationName: participant.organization_name,
                                pssName: participant.pss_name,
                            };
                        }
                    } catch (err) {
                        console.error("session callback error:", err);
                    }
                }
            }
            return session;
        },
    },

    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
    },

    debug: process.env.NODE_ENV === "development",
};
