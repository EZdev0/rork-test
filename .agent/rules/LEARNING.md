# 🧠 System Memory & Learned Constraints (LEARNING.md)

*This file acts as long-term memory for all AI tools working in this repository to prevent repeating past errors.*

## 📋 Resolved Lessons & Known Issues

### [2026-03-02] React Hooks Order & Conditional Returns
- **[ERROR]** `Rendered fewer hooks than expected` runtime error.
- **[CAUSE]** React Hook called conditionally after an early `if (!data) return null;` check.
- **[PREVENTION]** Declare all React Hooks (`useState`, `useMemo`, `useCallback`) unconditionally at the very top of the component function before any return statements.

### [2026-03-02] Asynchronous Fetch Timeouts
- **[ERROR]** App hangs on weak network connections during web requests.
- **[CAUSE]** Missing timeout configuration on fetch calls.
- **[PREVENTION]** Pass an `AbortSignal.timeout(ms)` or custom signal to every network request.

### [2026-03-02] Read-Before-Write File Edits
- **[ERROR]** Overwriting imports or breaking adjacent functions during search/replace.
- **[CAUSE]** Editing a file without reading the surrounding lines.
- **[PREVENTION]** Always inspect complete file content before generating replacement chunks.

---

## 📝 Error Entry Template for Future AI Actions

```markdown
### [2026-09-12] Studio AI fetch CORS Issue in Web
- **[ERROR]** Studio KI fails to fetch when hosted or outside of Expo Go due to CORS blocks (`network error`).
- **[CAUSE]** `@rork-ai/toolkit-sdk`'s `useRorkAgent` uses a hardcoded `expoFetch` and `AGENT_URL` that cannot be overridden by default, which causes browsers to block the request via CORS.
- **[PREVENTION]** Patch `@rork-ai/toolkit-sdk/lib/module/agent.js` (and `.d.ts`) via `postinstall` to allow `fetch` overrides in `useRorkAgent`, then wrap the fetch call in `ChatProvider.tsx` using a CORS proxy (e.g. `corsproxy.io`) for web builds.

```markdown
### [YYYY-MM-DD] <Title of Issue>
- **[ERROR]** Description of failure.
- **[CAUSE]** Root cause analysis.
- **[PREVENTION]** Specific rule to avoid recurrence.
```

### [2026-09-12] Direct Push to Main Violation
- **[ERROR]** AI agent pushed fixes directly to the \main\ branch, bypassing the user's manual review process.
- **[CAUSE]** Missing strict Git workflow constraint in user preferences.
- **[PREVENTION]** Agents MUST ALWAYS create a feature branch, commit changes locally, push the branch to remote, and provide a Pull Request URL. The user will handle merging.
