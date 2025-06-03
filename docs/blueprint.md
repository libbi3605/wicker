# **App Name**: WickerSphere

## Core Features:

- User Authentication: Secure user authentication with username and password. Auto-login with __initial_auth_token, or anonymous login if unavailable. Display the full userId for identification.
- Chat Interface: One-to-one and group chat functionality with a sidebar for listing active chats.
- E2EE Messaging: End-to-end encryption for text and file messages using Web Crypto API.
- Ephemeral Messaging: Configurable expiration timers and burn-on-read options for messages, with status indicators.
- File Sharing: Ability to share small files (images, documents) within chats with client-side encryption, converting files to Base64 strings if small, and storing within the message document
- Typing Indicators: Indication of typing status of remote user(s)
- AI Message Assistance: AI tool to suggest expiration times or burn-on-read based on content analysis.

## Style Guidelines:

- Primary color: Deep Indigo (#4B0082) for security and sophistication.
- Background color: Light Gray (#F0F0F0) for a clean, neutral backdrop.
- Accent color: Electric Purple (#BF00FF) for highlights and call-to-actions.
- Body and headline font: 'Inter' (sans-serif) for a modern, neutral look. Recommended because this app is likely to show larger amounts of text and message logs.
- Code font: 'Source Code Pro' (monospace) for displaying code snippets, if any.
- Minimalist line icons for chat functions, status, and settings.
- Responsive layout using Tailwind CSS for seamless experience across devices, with sidebar for chats and main content area for conversation.