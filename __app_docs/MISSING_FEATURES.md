# Missing Features & Implementation Plan

This document outlines the major features from the project brief that are currently missing from the application.

## Core Missing Features

1.  **Mailbox Connection (OAuth 2.0)**
    *   **Description**: The application cannot yet connect to real Gmail or Outlook accounts. The entire user authentication and authorization process needs to be built.
    *   **Implementation**: Create API routes for OAuth start/callback, handle token exchange, encrypt and store tokens securely in Firestore.

2.  **Data Sync Engine**
    *   **Description**: There is no system to fetch email headers from a connected mailbox. This includes both the initial backfill (e.g., last 24 months) and ongoing incremental syncs.
    *   **Implementation**: Develop Cloud Functions (scheduled) to interact with the Gmail and Microsoft Graph APIs, using history/delta tokens to fetch new data efficiently.

3.  **Database & Data Models**
    *   **Description**: The application currently relies on static, mock data. The specified Firestore database schema (`mailboxes`, `messages`, `inventory`) needs to be created and integrated.
    *   **Implementation**: Set up Firestore collections and write application code to read from and write to these collections instead of using mock data. Implement Firestore security rules.

4.  **Functional "Safe Unsubscribe"**
    *   **Description**: The core "unsubscribe" action is not implemented. UI buttons are present but have no effect.
    *   **Implementation**: Build the backend logic to parse `List-Unsubscribe` headers, perform one-click HTTP POST requests (RFC 8058), or generate pre-filled `mailto:` links.

5.  **AI-Powered Domain Suggestion**
    *   **Description**: The AI tool to suggest the correct "unsubscribe" domain for an email is not yet implemented.
    *   **Implementation**: Create a Genkit flow that takes email headers as input and uses an LLM to suggest the most likely root domain for the subscription.

6.  **Backend API Routes**
    *   **Description**: Most of the necessary API route handlers in Next.js (for OAuth, data fetching, or unsubscribe actions) have not been created.
    *   **Implementation**: Create the required `app/api/...` routes to handle client-side requests and orchestrate backend logic.
