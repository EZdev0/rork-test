# 🛠️ Workspace Engineering Standards & Operational Rules

## 1. TypeScript & Type Safety
- **Strict Mode:** TypeScript strict mode is mandatory.
- **No `any` Types:** Use explicit interfaces/types or `unknown` with type guards.
- **Null Safety:** Always validate object properties before dereferencing (`optional?.chaining` or explicit null checks).

## 2. React & React Native Best Practices
- **Hooks Order:** Hooks (`useState`, `useMemo`, `useCallback`, `useEffect`) MUST be declared at the top of functional components, BEFORE any conditional `return` statements.
- **Performance:** Wrap heavy computations in `useMemo` and event handlers in `useCallback`.
- **Inline Styles:** Avoid inline style objects inside render loops; use static style sheets or memoized styles.

## 3. Asynchronous Operations & Fetching
- **Timeouts:** All HTTP requests and asynchronous calls must include timeouts and graceful error handling.
- **Error Messages:** Display user-friendly error messages while logging full diagnostic tracebacks for debugging.

## 4. Read-Before-Write Protocol
- Always view and inspect the complete target file before applying edits.
- Do not make partial assumptions about import paths, variable names, or exported interfaces.
