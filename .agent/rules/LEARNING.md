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
### [YYYY-MM-DD] <Title of Issue>
- **[ERROR]** Description of failure.
- **[CAUSE]** Root cause analysis.
- **[PREVENTION]** Specific rule to avoid recurrence.
```
