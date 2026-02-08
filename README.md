# Participant Portal

A Progressive Web App (PWA) for participants to communicate with their peer support specialists and track their recovery goals.

## Features

- **Secure Messaging** - Two-way communication with peer support specialists
- **Goal Tracking** - View active and completed recovery goals
- **Mobile-First Design** - Optimized for phones, works on any device
- **PWA Support** - Installable on mobile devices for app-like experience
- **Cognito Authentication** - Secure sign-in using AWS Cognito

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Neon PostgreSQL (shared with staff app)
- **Auth**: NextAuth.js with AWS Cognito
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Primary | Slate Blue | `#5B7C99` |
| Secondary | Warm Teal | `#4A9B9B` |
| Background | Soft Gray | `#F7F8FA` |
| Text | Charcoal | `#374151` |

## Setup Instructions

### 1. AWS Cognito Setup

You'll use the same Cognito User Pool as the staff app, but create a new App Client:

1. Go to **AWS Cognito Console** → Your User Pool → **App Integration**

2. **Create a new App Client** for participants:
   - Name: `Participant Portal`
   - Generate client secret: **YES**
   - Auth flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
   - Callback URLs:
     - `https://portal.peersupportstudio.com/api/auth/callback/cognito`
     - `http://localhost:3001/api/auth/callback/cognito`
   - Sign out URLs:
     - `https://portal.peersupportstudio.com`
     - `http://localhost:3001`
   - Scopes: `email`, `openid`, `profile`

3. **Create a user group** (optional, for organization):
   - Go to **Users and groups** → **Groups** → **Create group**
   - Group name: `participants`
   - Description: `Participant Portal Users`

4. Copy the new **Client ID** and **Client Secret**

### 2. Environment Variables

Create a `.env.local` file:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-here

# Cognito (new client for participants)
COGNITO_CLIENT_ID=your-participant-client-id
COGNITO_CLIENT_SECRET=your-participant-client-secret
COGNITO_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/us-east-2_XXXXXXX
COGNITO_DOMAIN=https://your-domain.auth.us-east-2.amazoncognito.com

# Database (same as staff app)
DATABASE_URL=postgresql://...
```

### 3. Local Development

```bash
# Install dependencies
npm install

# Start development server (runs on port 3001)
npm run dev
```

Visit `http://localhost:3001`

### 4. Vercel Deployment

1. **Create a new Vercel project** (separate from staff app)

2. **Connect your repository** or import the portal folder

3. **Add environment variables** in Vercel dashboard:
   - `NEXTAUTH_URL` = `https://your-portal-domain.vercel.app`
   - `NEXTAUTH_SECRET` = (generate a new one)
   - `COGNITO_CLIENT_ID` = (participant client)
   - `COGNITO_CLIENT_SECRET` = (participant secret)
   - `COGNITO_ISSUER` = (same as staff app)
   - `COGNITO_DOMAIN` = (same as staff app)
   - `DATABASE_URL` = (same as staff app)

4. **Deploy!**

### 5. Custom Domain (Optional)

1. In Vercel, go to **Settings** → **Domains**
2. Add `portal.peersupportstudio.com`
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to the custom domain
5. Update Cognito callback URLs

## Database Requirements

The portal uses existing tables from the staff app:

- `participants` - Participant records
- `participant_credentials` - Portal access credentials
- `goals` - Recovery goals
- `conversations` - Message threads
- `conversation_members` - Who's in each conversation
- `messages` - Individual messages

### Enable Portal Access for a Participant

To allow a participant to access the portal, the staff app needs to:

1. Create a `participant_credentials` record:

```sql
INSERT INTO participant_credentials (
    participant_id,
    email,
    portal_enabled,
    status
) VALUES (
    'participant-uuid',
    'participant@email.com',
    true,
    'active'
);
```

2. The participant creates a Cognito account with that email
3. On first login, the portal links their Cognito ID

## PWA Installation

Users can install the portal as an app on their phone:

### iOS (Safari)
1. Open portal in Safari
2. Tap Share button
3. Tap "Add to Home Screen"

### Android (Chrome)
1. Open portal in Chrome
2. Tap menu (three dots)
3. Tap "Add to Home screen"

## Project Structure

```
participant-portal/
├── app/
│   ├── layout.tsx          # Root layout with PWA meta
│   ├── page.tsx            # Landing/login page
│   ├── dashboard/          # Main dashboard
│   ├── messages/           # Messaging feature
│   │   ├── page.tsx        # Conversation list
│   │   └── [conversationId]/ # Thread view
│   ├── goals/              # Goals feature
│   ├── settings/           # Profile & settings
│   ├── auth/               # Auth pages
│   └── api/                # API routes
├── components/
│   ├── layout/             # Navigation, headers
│   └── ui/                 # Shared UI components
├── lib/
│   ├── auth.ts             # Auth helpers
│   ├── auth-options.ts     # NextAuth config
│   └── db.ts               # Database helpers
├── types/                  # TypeScript types
└── public/
    ├── manifest.json       # PWA manifest
    └── icons/              # App icons
```

## Future Enhancements

- [ ] Push notifications (Firebase)
- [ ] Recovery Capital score visualization
- [ ] Session summaries view
- [ ] Appointment scheduling
- [ ] Self-check-in forms
- [ ] Resource library
- [ ] Offline support

## Support

For technical issues, contact the development team.

For participant support, contact your peer support specialist.

---

Built with ❤️ by MADe180 | Peer Support Studio
