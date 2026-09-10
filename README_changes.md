# AI Integration & Streaming Updates

1. **Routing and Dynamic Model Loading**
   - Custom endpoints (e.g. from Netlify or local) are now properly parsed. The system enforces `http://` or `https://` prefix to avoid internal 404 router interceptions.
   - Dynamic OpenRouter (`https://openrouter.ai/api/v1/models`) and Custom models are now fetched and rendered directly in the Settings dropdowns.

2. **System Prompt Localization**
   - All internal system prompts across `ai-service`, `ChatProvider`, and `multi-agent-system` have been translated to English as requested to standardize instructions and improve reliability for complex coding tasks.

3. **Thinking Streaming Optimization**
   - Reworked `parseThinkingFromContent` to properly capture *unclosed* `<think>` tags progressively during streaming output, eliminating UI stuttering where the thinking block appeared only after completion.

4. **Studio KI Native Fetch**
   - Replaced the failing `@rork-ai/toolkit-sdk` execution with a native direct `fetch` to `https://toolkit.rork.com/llm/text` while maintaining proper chat payload formatting (injecting placeholder text to avoid SDK unhandled null exceptions).
