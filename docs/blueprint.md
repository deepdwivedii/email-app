# **App Name**: Header Harbor

## Core Features:

- Mailbox Connection: Connect to Gmail and Outlook accounts using OAuth 2.0. Securely store encrypted tokens.
- Header Indexing: Index email headers (From, To, Subject, Date, List-Unsubscribe) from connected mailboxes. Initial backfill and incremental sync via Gmail History and Microsoft Graph Delta.
- Domain Aggregation: Aggregate indexed data by root domain to identify subscription sources. Show counts, last seen, category, unsubscribe status.
- Unsubscribe Suggestion: Suggest a primary domain for a selected email header that could be the origin of the message using generative AI, as a tool, given the context of existing subscriptions. Present result with unsubscribe options.
- Safe Unsubscribe: Unsubscribe from mailing lists using List-Unsubscribe headers (one-click POST or mailto:).
- Dashboard: Display an inventory table grouped by root domain with counts, lastSeen, category, unsubscribe options, and actions to manage subscriptions.
- Scheduled Sync: Schedule background sync jobs to fetch new email headers regularly and update the index.

## Style Guidelines:

- Primary color: A calming light-blue (#72BCD4), evocative of the sky where emails travel, but still conveys modernity.
- Background color: Very light desaturated blue (#F0F8FF), providing a clean, uncluttered backdrop.
- Accent color: A more vibrant blue-green (#008080), used sparingly for interactive elements and important calls to action.
- Body text: 'Inter', sans-serif. Headlines: 'Space Grotesk', sans-serif.
- Use simple, clear icons for mailbox types (Gmail, Outlook) and actions (unsubscribe, mark as moved).
- Dashboard: Display inventory in a clean, tabular format, grouped by domain. Use expandable rows to show more details about each domain.
- Subtle transitions when loading new data or updating inventory.