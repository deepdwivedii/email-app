## UI File Map

This document lists the main files responsible for the user interface: pages, components, hooks, and styles that control text, buttons, and layout.

### Root Layout and Global Styles

- `src/app/layout.tsx` – Root HTML/body layout, sticky header, global nav, auth shell, and toaster mount.
- `src/app/globals.css` – Tailwind base setup plus design tokens for colors, typography, and global body styles.
- `tailwind.config.ts` – Tailwind theme configuration (colors, radii, fonts) used across all UI components.

### Top-Level Pages (Routes)

Each of these files is a page in the app router and is responsible for the UI and text for its route:

- `src/app/page.tsx` – Marketing/landing page with hero, CTA buttons, and “How it works” sections.
- `src/app/auth/page.tsx` – Combined sign-in/sign-up experience (drives auth-related UI text and forms).
- `src/app/login/page.tsx` – Login entry point (legacy/alias for auth).
- `src/app/signup/page.tsx` – Signup entry point (legacy/alias for auth).
- `src/app/dashboard/page.tsx` – Dashboard shell UI.
- `src/app/overview/page.tsx` – Overview UI showing high-level account/inbox state.
- `src/app/subscriptions/page.tsx` – Subscriptions list UI and related text.
- `src/app/accounts/page.tsx` – Accounts list UI.
- `src/app/accounts/[id]/page.tsx` – Single account detail UI.
- `src/app/mailboxes/page.tsx` – Mailboxes list UI.
- `src/app/messages/page.tsx` – Messages listing UI.
- `src/app/tasks/page.tsx` – Tasks list UI.
- `src/app/onboarding/page.tsx` – Onboarding flow UI and copy.
- `src/app/overview/page.tsx` – Overview screen (high-level metrics and summaries).
- `src/app/privacy/page.tsx` – Privacy policy page text/layout.
- `src/app/security/page.tsx` – Security information page text/layout.
- `src/app/support/page.tsx` – Support/contact/help page.
- `src/app/terms/page.tsx` – Terms of service text/layout.
- `src/app/subscriptions/page.tsx` – Subscriptions management UI.

Settings pages:

- `src/app/settings/page.tsx` – Settings hub UI.
- `src/app/settings/privacy/page.tsx` – Privacy settings screen.
- `src/app/settings/data/page.tsx` – Data/export/delete settings UI.
- `src/app/settings/advanced/page.tsx` – Advanced settings UI.
- `src/app/settings/advanced/messages/page.tsx` – Advanced message-related settings UI.
- `src/app/settings/connections/page.tsx` – Connections/integrations settings UI.

### Shared Layout and Navigation Components

- `src/components/main-nav.tsx` – Top navigation (desktop and mobile sheet menu) linking to Overview, Subscriptions, Accounts, Tasks, Settings.
- `src/components/auth-button.tsx` – Auth-related button in the header (sign in/out, profile entry).
- `src/components/icons.tsx` – AppLogo and other icon components used throughout the UI.

### Feature-Level UI Components

- `src/components/domain-table.tsx` – Table UI for displaying domains/subscriptions.
- `src/components/email-detail-row.tsx` – Row layout for individual email details.
- `src/components/suggest-unsubscribe-dialog.tsx` – Dialog UI for suggesting unsubscribe actions.

### UI Primitive Components (`src/components/ui`)

These files implement reusable UI primitives (buttons, cards, dialogs, etc.) used across pages:

- `src/components/ui/accordion.tsx` – Collapse/expand sections.
- `src/components/ui/alert.tsx` – Inline alert messages.
- `src/components/ui/alert-dialog.tsx` – Confirmation dialog for destructive or important actions.
- `src/components/ui/avatar.tsx` – Avatar image/initials component.
- `src/components/ui/badge.tsx` – Small status/tag labels.
- `src/components/ui/button.tsx` – Primary button component with variants (default, outline, destructive, etc.).
- `src/components/ui/calendar.tsx` – Date selection UI.
- `src/components/ui/card.tsx` – Card container with header/content structure.
- `src/components/ui/carousel.tsx` – Carousel/slides for content.
- `src/components/ui/chart.tsx` – Chart wrapper component for visualizations.
- `src/components/ui/checkbox.tsx` – Checkbox input styling/behavior.
- `src/components/ui/collapsible.tsx` – Show/hide content section.
- `src/components/ui/dialog.tsx` – Modal dialog shell.
- `src/components/ui/dropdown-menu.tsx` – Trigger + menu pattern for dropdowns.
- `src/components/ui/form.tsx` – Form field wrappers and validation-aware UI.
- `src/components/ui/input.tsx` – Text input field styling.
- `src/components/ui/label.tsx` – Accessible form labels.
- `src/components/ui/menubar.tsx` – Menu bar navigation widget.
- `src/components/ui/popover.tsx` – Floating content anchored to a trigger.
- `src/components/ui/progress.tsx` – Progress bar.
- `src/components/ui/radio-group.tsx` – Group of radio buttons.
- `src/components/ui/scroll-area.tsx` – Scrollable container with styled scrollbars.
- `src/components/ui/select.tsx` – Select/dropdown input.
- `src/components/ui/separator.tsx` – Horizontal/vertical separator line.
- `src/components/ui/sheet.tsx` – Slide-out panel (used for mobile navigation, side drawers).
- `src/components/ui/sidebar.tsx` – Sidebar shell layout.
- `src/components/ui/skeleton.tsx` – Skeleton loading placeholders.
- `src/components/ui/slider.tsx` – Slider input control.
- `src/components/ui/switch.tsx` – Toggle switch control.
- `src/components/ui/table.tsx` – Table elements for tabular data.
- `src/components/ui/tabs.tsx` – Tabs navigation component.
- `src/components/ui/textarea.tsx` – Multi-line text input.
- `src/components/ui/toast.tsx` – Toast notification UI.
- `src/components/ui/toaster.tsx` – Global toast provider mounted in `layout.tsx`.
- `src/components/ui/tooltip.tsx` – Tooltip content and trigger.

### UI-Related Hooks

- `src/hooks/use-auth.tsx` – Authentication state hook used by UI components (e.g., header, main nav, pages) to control what is shown.
- `src/hooks/use-mobile.tsx` – Hook for responsive behavior (detects mobile viewport to adjust UI).
- `src/hooks/use-toast.ts` – Hook to trigger and control toast notifications.

### Static Assets

- `public/logo.png` – Logo used in the UI (referenced by icon components).
- `logo.png` (project root) – Brand logo asset.

