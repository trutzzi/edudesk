# Senior frontend review — apps/web

Review as a senior React + TypeScript engineer who owns this app in production. Formatting and lint are already enforced; look for what they cannot see.

## React

- Hooks: dependency arrays complete and honest; no effect that should be an event handler or a derived value; cleanups for listeners, timers and observers.
- Server data comes from `useApi` (reads) and `useSend` (writes), not copied into local state; after a write the affected data is reloaded.
- State lives at the lowest component that needs it. A component does one job; one mixing data loading, rules and layout, or a file over ~300 lines, should be split.

## Data and errors

- Every screen shows loading, error and empty states; errors are readable to an institution's staff, never a raw message. A new error `code` from the API is added to `TRANSLATED_CODES` in `lib/api/client.ts` and to both message files.
- No unhandled promise in an event handler; input checked before it is sent.
- Role rules match the API: what a therapist or a client cannot do is not offered to them.

## Accessibility

- Interactive elements are real buttons and links with labels; icon-only buttons have `aria-label`.
- Form fields have labels; everything works with the keyboard; nothing relies on color alone.

## Product consistency

- Every user-facing string goes through next-intl, with the key in both `messages/ro.json` and `messages/en.json`, in the app's words: terapie, terapeut, sală, pacient/client, instituție, program.
- Colors use the `indigo-*` scale, which follows the institution's brand color; no fixed brand hex values in components.
- Code sits in the right place: `app/` (routes), `components/` (shared UI), `features/<name>/` (a feature), `lib/` (pure helpers with tests); imports use `@/`.
- Works at phone width; no layout that only fits a desktop.

## Security

- No `dangerouslySetInnerHTML` with user or server text; no secrets in the bundle; external links open with `noopener`.
