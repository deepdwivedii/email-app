# Header Harbor - Development Guide

## Overview

Header Harbor is a Next.js-based email subscription management application that helps users review marketing senders, unsubscribe from unwanted emails, and manage their inbox efficiently. The app integrates with Gmail and Outlook via OAuth 2.0 and uses AI-powered suggestions for domain categorization.

## Quick Start

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Latest version
- **Firebase Project**: Set up with Firestore and Authentication
- **Google Cloud Project**: For Gmail API access
- **Microsoft Azure App**: For Outlook/Graph API access

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd email-app
npm install
```

2. **Environment Setup:**
Create a `.env.local` file in the root directory:
```bash
# Gmail OAuth
GMAIL_OAUTH_CLIENT_ID=your_gmail_client_id
GMAIL_OAUTH_CLIENT_SECRET=your_gmail_client_secret

# Microsoft OAuth
MS_OAUTH_CLIENT_ID=your_microsoft_client_id
MS_OAUTH_CLIENT_SECRET=your_microsoft_client_secret

# Firebase Admin (for local development)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Optional: AI/Genkit configuration
GOOGLE_GENAI_API_KEY=your_genai_api_key
```

3. **Run the development server:**
```bash
npm run dev
```
The app will be available at `http://localhost:9002`

### Available Scripts

```bash
# Development
npm run dev              # Start Next.js dev server with Turbopack on port 9002
npm run genkit:dev       # Start Genkit AI development server
npm run genkit:watch     # Start Genkit with file watching

# Production
npm run build            # Build the application
npm run start            # Start production server on port 9002

# Quality Assurance
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking
```

## Tech Stack

### Core Framework
- **Next.js 15.3.3**: React framework with App Router
- **React 18.3.1**: UI library
- **TypeScript 5**: Type safety and development experience

### Styling & UI
- **Tailwind CSS 3.4.1**: Utility-first CSS framework
- **Radix UI**: Headless UI components for accessibility
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu
  - Label, Menubar, Popover, Progress, Radio Group, Scroll Area
  - Select, Separator, Slider, Switch, Tabs, Toast, Tooltip
- **Lucide React**: Icon library
- **Class Variance Authority**: Component variant management
- **Tailwind Merge**: Utility for merging Tailwind classes
- **Tailwindcss Animate**: Animation utilities

### Backend & Database
- **Firebase 11.9.1**: Backend-as-a-Service platform
  - **Firestore**: NoSQL document database
  - **Firebase Functions 4.9.0**: Serverless functions
  - **Firebase Admin 12.6.0**: Server-side Firebase SDK
  - **Firebase Hosting**: Static site hosting with App Hosting backend

### Authentication & APIs
- **Google Auth Library 9.14.2**: Gmail OAuth integration
- **Azure MSAL Node 2.6.6**: Microsoft OAuth integration
- **OAuth 2.0**: Authentication protocol for Gmail and Outlook

### AI & Machine Learning
- **Genkit 1.14.1**: Google's AI framework
- **@genkit-ai/googleai**: Google AI integration
- **@genkit-ai/next**: Next.js integration for Genkit

### Form Handling & Validation
- **React Hook Form 7.54.2**: Form state management
- **Zod 3.24.2**: Schema validation
- **@hookform/resolvers**: Form validation resolvers

### Data Fetching & State Management
- **SWR 2.2.5**: Data fetching and caching
- **Date-fns 3.6.0**: Date manipulation utilities

### Development Tools
- **PostCSS 8**: CSS processing
- **ESLint**: Code linting
- **Patch Package**: NPM package patching

## Application Architecture

### Directory Structure

```
src/
├── ai/                          # AI/Genkit integration
│   ├── dev.ts                   # Genkit development server
│   ├── genkit.ts               # Genkit configuration
│   └── flows/                   # AI flows
│       └── suggest-unsubscribe-domain.ts
├── app/                         # Next.js App Router
│   ├── api/                     # API routes
│   │   ├── inventory/           # Domain inventory endpoints
│   │   ├── oauth/               # OAuth authentication
│   │   │   ├── google/          # Gmail OAuth
│   │   │   └── microsoft/       # Outlook OAuth
│   │   ├── sync/                # Email synchronization
│   │   └── unsubscribe/         # Unsubscribe functionality
│   ├── connect/                 # OAuth connection page
│   ├── dashboard/               # Main dashboard
│   ├── privacy/                 # Privacy policy
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/                  # React components
│   ├── ui/                      # Reusable UI components (Radix-based)
│   ├── domain-table.tsx         # Domain management table
│   ├── email-detail-row.tsx     # Email detail display
│   ├── icons.tsx                # Custom icons
│   └── suggest-unsubscribe-dialog.tsx
├── functions/                   # Firebase Cloud Functions
│   └── index.ts                 # Scheduled sync functions
├── hooks/                       # Custom React hooks
│   ├── use-mobile.tsx           # Mobile detection
│   └── use-toast.ts             # Toast notifications
├── lib/                         # Utility libraries
│   ├── server/                  # Server-side utilities
│   │   ├── crypto.ts            # Encryption/decryption
│   │   ├── db.ts                # Database operations
│   │   └── firebase-admin.ts    # Firebase Admin setup
│   ├── data.ts                  # Mock data and aggregation
│   ├── firebase.ts              # Client-side Firebase config
│   ├── placeholder-images.ts    # Image placeholders
│   └── utils.ts                 # General utilities
└── types/                       # TypeScript type definitions
    └── index.ts                 # Core data types
```

## Data Models & Types

### Core Types

```typescript
// Email message type
export type Email = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
};

// Domain information aggregation
export type DomainInfo = {
  domain: string;
  count: number;
  lastSeen: string;
  category: 'Marketing' | 'Social' | 'Transactional' | 'Updates' | 'Other';
  isUnsubscribed: boolean;
  emails: Email[];
  inventoryId?: string;
};
```

### Database Schema (Firestore)

```typescript
// Mailbox collection
export type Mailbox = {
  id: string;                    // Document ID
  provider: 'gmail' | 'outlook'; // Email provider
  email: string;                 // User's email address
  tokenBlobEncrypted: string;    // Encrypted OAuth tokens
  cursor?: string;               // Sync cursor (historyId/deltaToken)
  connectedAt: number;           // Connection timestamp
  lastSyncAt?: number;           // Last sync timestamp
};

// Messages collection
export type Message = {
  id: string;                    // Document ID
  mailboxId: string;             // Reference to mailbox
  providerMsgId: string;         // Provider's message ID
  from?: string;                 // Sender address
  to?: string;                   // Recipient address
  subject?: string;              // Email subject
  receivedAt: number;            // Received timestamp
  listUnsubscribe?: string;      // Unsubscribe header
  listUnsubscribePost?: string;  // One-click unsubscribe header
  dkimDomain?: string;           // DKIM domain
  rootDomain?: string;           // Extracted root domain
  category?: string;             // Email category
};

// Inventory collection (domain aggregation)
export type Inventory = {
  id: string;                    // Document ID
  mailboxId: string;             // Reference to mailbox
  rootDomain: string;            // Root domain name
  displayName?: string;          // Human-readable name
  firstSeen: number;             // First occurrence timestamp
  lastSeen: number;              // Last occurrence timestamp
  msgCount: number;              // Total message count
  hasUnsub: boolean;             // Has unsubscribe capability
  changeEmailUrl?: string;       // Email change URL
  status: 'active' | 'moved' | 'ignored'; // Domain status
};
```

### AI Flow Types

```typescript
// AI domain suggestion input
export type SuggestUnsubscribeDomainInput = {
  from: string;                  // From header
  to: string;                    // To header
  subject: string;               // Subject header
  listUnsubscribe?: string;      // List-Unsubscribe header
  existingSubscriptions: string[]; // Known domains
};

// AI domain suggestion output
export type SuggestUnsubscribeDomainOutput = {
  suggestedDomain: string;       // Suggested root domain
  confidence: number;            // Confidence score (0-1)
  reason: string;                // Reasoning explanation
};
```

## Configuration Files

### Next.js Configuration (`next.config.ts`)
```typescript
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,     // For development flexibility
  },
  eslint: {
    ignoreDuringBuilds: true,    // Skip linting during builds
  },
  images: {
    remotePatterns: [            // Allowed image domains
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};
```

### Tailwind Configuration (`tailwind.config.ts`)
- **Dark Mode**: Class-based dark mode support
- **Custom Colors**: HSL-based color system with CSS variables
- **Typography**: Inter (body), Space Grotesk (headlines), monospace (code)
- **Animations**: Accordion animations and custom keyframes
- **Plugins**: tailwindcss-animate for enhanced animations

### TypeScript Configuration (`tsconfig.json`)
- **Target**: ES2017 for modern browser support
- **Module Resolution**: Bundler mode for Next.js
- **Path Mapping**: `@/*` maps to `./src/*`
- **Strict Mode**: Enabled for type safety

### Firebase Configuration
- **Hosting**: Next.js app with frameworks backend
- **Region**: us-central1
- **Project**: studio-8723461064-1f69a

## Key Features & Implementation

### 1. OAuth Authentication
- **Gmail**: Uses Google OAuth 2.0 with Gmail metadata scope
- **Outlook**: Uses Microsoft Graph API with Mail.Read scope
- **Security**: Tokens encrypted and stored in Firestore
- **Session**: httpOnly cookies for mailbox identification

### 2. Email Synchronization
- **Gmail**: History API for incremental sync
- **Outlook**: Delta queries for efficient updates
- **Scheduling**: Cloud Functions run every 10 minutes
- **Headers**: Extracts List-Unsubscribe and other metadata

### 3. AI-Powered Suggestions
- **Genkit Integration**: Google's AI framework
- **Domain Suggestion**: AI suggests unsubscribe domains
- **Confidence Scoring**: Provides reasoning and confidence levels

### 4. Unsubscribe Management
- **One-Click**: RFC 8058 compliant HTTP POST unsubscribe
- **Mailto**: Fallback to email-based unsubscribe
- **Status Tracking**: Persistent unsubscribe status

## Environment Variables

### Required for Production
```bash
# Gmail OAuth (Google Cloud Console)
GMAIL_OAUTH_CLIENT_ID=your_gmail_client_id
GMAIL_OAUTH_CLIENT_SECRET=your_gmail_client_secret

# Microsoft OAuth (Azure Portal)
MS_OAUTH_CLIENT_ID=your_microsoft_client_id
MS_OAUTH_CLIENT_SECRET=your_microsoft_client_secret

# Firebase Admin (Service Account)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

### Optional for AI Features
```bash
# Google Generative AI
GOOGLE_GENAI_API_KEY=your_genai_api_key
```

## OAuth Setup

### Google (Gmail)
1. Create project in Google Cloud Console
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `http://localhost:9002/api/oauth/google/callback` (development)
   - `https://your-domain/api/oauth/google/callback` (production)
5. Scopes: `gmail.metadata`, `openid`, `email`

### Microsoft (Outlook)
1. Register app in Azure Portal
2. Add Microsoft Graph permissions
3. Configure redirect URIs:
   - `http://localhost:9002/api/oauth/microsoft/callback` (development)
   - `https://your-domain/api/oauth/microsoft/callback` (production)
4. Scopes: `Mail.Read`, `offline_access`, `openid`, `email`, `profile`

## API Endpoints

### Authentication
- `GET /api/oauth/google/start` - Initiate Gmail OAuth
- `GET /api/oauth/google/callback` - Handle Gmail OAuth callback
- `GET /api/oauth/microsoft/start` - Initiate Outlook OAuth
- `GET /api/oauth/microsoft/callback` - Handle Outlook OAuth callback

### Data Operations
- `GET /api/inventory` - Fetch domain inventory
- `POST /api/sync` - Trigger email synchronization
- `POST /api/unsubscribe` - Process unsubscribe request

## Security Considerations

### Data Protection
- **Token Encryption**: OAuth tokens encrypted at rest
- **Secure Cookies**: httpOnly, sameSite, secure flags
- **No Logging**: Secrets never logged or exposed
- **Firestore Rules**: Database access controls

### API Security
- **CORS**: Configured for specific origins
- **Rate Limiting**: Implemented via Firebase
- **Input Validation**: Zod schema validation
- **Error Handling**: Sanitized error responses

## Development Workflow

### Local Development
1. Set up environment variables
2. Configure OAuth applications
3. Run `npm run dev` for Next.js
4. Run `npm run genkit:dev` for AI features
5. Use Firebase Emulator for local testing

### Testing
- **Type Checking**: `npm run typecheck`
- **Linting**: `npm run lint`
- **Manual Testing**: Use dashboard sync functionality

### Deployment
1. Build: `npm run build`
2. Deploy to Firebase Hosting
3. Configure production environment variables
4. Set up Cloud Functions scheduling

## Troubleshooting

### Common Issues
1. **OAuth Errors**: Check redirect URIs and credentials
2. **Sync Failures**: Verify API permissions and tokens
3. **Build Errors**: Run type checking and fix TypeScript issues
4. **Firebase Errors**: Check service account permissions

### Debug Tools
- **Next.js DevTools**: Built-in debugging
- **Firebase Console**: Monitor functions and database
- **Browser DevTools**: Network and console debugging
- **Genkit DevTools**: AI flow debugging

## Contributing

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for Next.js and React
- **Prettier**: Code formatting (if configured)
- **Naming**: camelCase for variables, PascalCase for components

### Git Workflow
- **Branches**: Feature branches from main
- **Commits**: Conventional commit messages
- **PRs**: Code review required
- **Testing**: Ensure all checks pass

This guide provides a comprehensive overview of the Header Harbor email application, covering everything from initial setup to advanced development workflows. The application leverages modern web technologies and AI capabilities to provide a robust email management solution.