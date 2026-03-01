import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { z } from 'zod';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { ChatMessage, ToolCall, AIProviderType, InlineTodo, PendingToolApproval, TOOL_REGISTRY } from '@/types';
import { callAI, TOOL_DEFINITIONS, buildSystemPrompt, parseThinkingFromContent } from '@/utils/ai-service';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';

function genId(): string {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export const [ChatProvider, useChat] = createContextHook(() => {
  const [manualMessages, setManualMessages] = useState<ChatMessage[]>([]);
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingPhase, setThinkingPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [lastFallbackInfo, setLastFallbackInfo] = useState<string | null>(null);
  const [rorkLoading, setRorkLoading] = useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<PendingToolApproval | null>(null);
  const abortRef = useRef<boolean>(false);
  const manualMessagesRef = useRef<ChatMessage[]>([]);
  manualMessagesRef.current = manualMessages;
  const rorkContextSentRef = useRef<boolean>(false);

  const { settings, getApiKey, getFallbackSettings, todos, memos, addTodo, updateTodoItem, addMemo, agentMd, soulMd, getToolPermission } = useApp();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
  } = useProject();

  const opsRef = useRef({
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
    addTodo, updateTodoItem, addMemo, settings,
  });
  opsRef.current = {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
    addTodo, updateTodoItem, addMemo, settings,
  };

  const isRorkProvider = settings.selectedProvider === 'rork';

  const rorkTools = useMemo(() => ({
    read_file: createRorkTool({
      description: 'Liest den Inhalt einer Datei. MUSS vor jeder Bearbeitung aufgerufen werden.',
      zodSchema: z.object({ path: z.string().describe('Dateipfad relativ zum Projektstamm') }),
      execute: (input: { path: string }) => {
        console.log('[Rork] read_file:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'FEHLER: Datei "' + input.path + '" nicht gefunden.';
        return content;
      },
    }),
    write_file: createRorkTool({
      description: 'Schreibt Inhalt in eine Datei (überschreibt). Datei muss vorher gelesen werden.',
      zodSchema: z.object({ path: z.string(), content: z.string().describe('Neuer Dateiinhalt') }),
      execute: (input: { path: string; content: string }) => {
        console.log('[Rork] write_file:', input.path);
        opsRef.current.updateFileContent(input.path, input.content);
        return 'Datei "' + input.path + '" geschrieben (' + input.content.split('\n').length + ' Zeilen).';
      },
    }),
    create_file: createRorkTool({
      description: 'Erstellt eine neue Datei. Ordner werden automatisch erstellt.',
      zodSchema: z.object({ path: z.string(), content: z.string().describe('Dateiinhalt') }),
      execute: (input: { path: string; content: string }) => {
        console.log('[Rork] create_file:', input.path);
        opsRef.current.createFile(input.path, input.content);
        return 'Datei "' + input.path + '" erstellt.';
      },
    }),
    edit_file: createRorkTool({
      description: 'Bearbeitet eine Datei durch Ersetzen von Text. Datei MUSS vorher mit read_file gelesen werden. old_text muss exakt übereinstimmen.',
      zodSchema: z.object({ path: z.string(), old_text: z.string().describe('Exakter Text der ersetzt werden soll'), new_text: z.string().describe('Neuer Text') }),
      execute: (input: { path: string; old_text: string; new_text: string }) => {
        console.log('[Rork] edit_file:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'FEHLER: Datei nicht gefunden. Bitte erst mit read_file lesen.';
        if (!content.includes(input.old_text)) return 'FEHLER: Text nicht gefunden in "' + input.path + '". Bitte Datei erneut mit read_file lesen.';
        opsRef.current.updateFileContent(input.path, content.replace(input.old_text, input.new_text));
        return 'Datei "' + input.path + '" bearbeitet.';
      },
    }),
    delete_file: createRorkTool({
      description: 'Löscht eine Datei oder einen leeren Ordner.',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] delete_file:', input.path);
        opsRef.current.deleteFile(input.path);
        return 'Datei "' + input.path + '" gelöscht.';
      },
    }),
    rename_file: createRorkTool({
      description: 'Benennt eine Datei oder Ordner um.',
      zodSchema: z.object({ old_path: z.string(), new_path: z.string() }),
      execute: (input: { old_path: string; new_path: string }) => {
        console.log('[Rork] rename_file:', input.old_path, '->', input.new_path);
        opsRef.current.renameFile(input.old_path, input.new_path);
        return 'Umbenannt: "' + input.old_path + '" → "' + input.new_path + '".';
      },
    }),
    list_directory: createRorkTool({
      description: 'Listet alle Dateien und Ordner in einem Verzeichnis auf.',
      zodSchema: z.object({ path: z.string().describe('Pfad (leer für Wurzelverzeichnis)') }),
      execute: (input: { path: string }) => {
        console.log('[Rork] list_directory:', input.path);
        return opsRef.current.listDirectory(input.path || '');
      },
    }),
    search_files: createRorkTool({
      description: 'Durchsucht alle Dateien nach Text (grep). Gibt Dateiname, Zeile und Kontext zurück.',
      zodSchema: z.object({ query: z.string().describe('Suchbegriff oder Regex'), path: z.string().optional().describe('Optionaler Pfad') }),
      execute: (input: { query: string; path?: string }) => {
        console.log('[Rork] search_files:', input.query);
        return opsRef.current.searchFilesInProject(input.query, input.path);
      },
    }),
    find_replace: createRorkTool({
      description: 'Sucht und ersetzt Text in einer Datei.',
      zodSchema: z.object({ path: z.string(), find: z.string(), replace: z.string() }),
      execute: (input: { path: string; find: string; replace: string }) => {
        console.log('[Rork] find_replace:', input.path);
        const content = opsRef.current.getFileContent(input.path);
        if (content === null) return 'FEHLER: Datei nicht gefunden.';
        const count = content.split(input.find).length - 1;
        opsRef.current.updateFileContent(input.path, content.split(input.find).join(input.replace));
        return count + ' Vorkommen in "' + input.path + '" ersetzt.';
      },
    }),
    create_directory: createRorkTool({
      description: 'Erstellt einen neuen Ordner.',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] create_directory:', input.path);
        opsRef.current.createDirectory(input.path);
        return 'Verzeichnis "' + input.path + '" erstellt.';
      },
    }),
    get_project_tree: createRorkTool({
      description: 'Gibt die gesamte Projektstruktur als Baumdarstellung zurück.',
      zodSchema: z.object({}),
      execute: () => {
        console.log('[Rork] get_project_tree');
        return opsRef.current.getProjectTree();
      },
    }),
    get_file_info: createRorkTool({
      description: 'Gibt Informationen über eine Datei zurück (Zeilen, Zeichen, Sprache).',
      zodSchema: z.object({ path: z.string() }),
      execute: (input: { path: string }) => {
        console.log('[Rork] get_file_info:', input.path);
        return opsRef.current.getFileInfo(input.path);
      },
    }),
    create_todo: createRorkTool({
      description: 'Erstellt einen neuen Todo-Eintrag im Projektplan.',
      zodSchema: z.object({ text: z.string().describe('Todo-Text') }),
      execute: (input: { text: string }) => {
        console.log('[Rork] create_todo:', input.text);
        const id = opsRef.current.addTodo(input.text);
        return JSON.stringify({ id, text: input.text, completed: false });
      },
    }),
    update_todo: createRorkTool({
      description: 'Aktualisiert einen Todo-Eintrag.',
      zodSchema: z.object({ id: z.string(), completed: z.boolean().optional(), text: z.string().optional() }),
      execute: (input: { id: string; completed?: boolean; text?: string }) => {
        console.log('[Rork] update_todo:', input.id);
        opsRef.current.updateTodoItem(input.id, input.completed, input.text);
        return 'Todo "' + input.id + '" aktualisiert.';
      },
    }),
    add_memo: createRorkTool({
      description: 'Speichert eine wichtige Notiz im Projektgedächtnis.',
      zodSchema: z.object({ content: z.string() }),
      execute: (input: { content: string }) => {
        console.log('[Rork] add_memo:', input.content);
        opsRef.current.addMemo(input.content);
        return 'Memo gespeichert.';
      },
    }),
    think: createRorkTool({
      description: 'Nutze dieses Tool um über ein komplexes Problem nachzudenken. Dein Gedankengang wird dem Benutzer angezeigt.',
      zodSchema: z.object({ thought: z.string().describe('Dein detaillierter Gedankengang') }),
      execute: (input: { thought: string }) => {
        console.log('[Rork] think:', input.thought.slice(0, 80));
        return 'Gedankengang verarbeitet.';
      },
    }),
    web_search: createRorkTool({
      description: 'Durchsucht das Web nach Informationen, Dokumentation und aktuellen Daten. Nutze dies für Recherche.',
      zodSchema: z.object({ query: z.string().describe('Suchbegriff') }),
      execute: async (input: { query: string }) => {
        console.log('[Rork] web_search:', input.query);
        const s = settingsRef.current;
        if (!s.yoloMode && !s.betaWebSearch) return 'FEHLER: Web-Suche ist nicht aktiviert. Bitte in den Beta-Einstellungen aktivieren.';
        const perm = s.yoloMode ? 'always' : (s.toolPermissions?.['web_search'] || 'ask');
        if (perm === 'blocked') return 'FEHLER: Web-Suche ist vom Nutzer blockiert.';
        if (perm === 'removed') return 'FEHLER: Unbekanntes Tool.';
        try {
          const resp = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(input.query) + '&format=json&no_redirect=1&no_html=1');
          if (!resp.ok) return 'Web-Suche fehlgeschlagen (Status ' + resp.status + ').';
          const data = await resp.json();
          let results = '';
          if (data?.Abstract) results += 'Zusammenfassung: ' + data.Abstract + '\n\n';
          if (data?.RelatedTopics) {
            for (const t of (data.RelatedTopics || []).slice(0, 8)) {
              if (t?.Text) results += '• ' + t.Text + '\n';
              if (t?.FirstURL) results += '  URL: ' + t.FirstURL + '\n';
            }
          }
          return results || 'Keine Ergebnisse gefunden für: ' + input.query;
        } catch (e: any) {
          return 'FEHLER bei Web-Suche: ' + (e?.message || 'Netzwerkfehler');
        }
      },
    }),
    web_fetch: createRorkTool({
      description: 'Lädt den Inhalt einer Webseite herunter und gibt den Text zurück (ohne HTML-Tags).',
      zodSchema: z.object({ url: z.string().describe('URL der Webseite'), max_length: z.number().optional().describe('Maximale Zeichenanzahl (Standard: 5000)') }),
      execute: async (input: { url: string; max_length?: number }) => {
        console.log('[Rork] web_fetch:', input.url);
        const s = settingsRef.current;
        if (!s.yoloMode && !s.betaWebFetch) return 'FEHLER: Web-Fetch ist nicht aktiviert. Bitte in den Beta-Einstellungen aktivieren.';
        const perm = s.yoloMode ? 'always' : (s.toolPermissions?.['web_fetch'] || 'ask');
        if (perm === 'blocked') return 'FEHLER: Web-Fetch ist vom Nutzer blockiert.';
        if (perm === 'removed') return 'FEHLER: Unbekanntes Tool.';
        try {
          const resp = await fetch(input.url, { headers: { 'Accept': 'text/html,text/plain,application/json' } });
          if (!resp.ok) return 'Fetch fehlgeschlagen (Status ' + resp.status + ').';
          const text = await resp.text();
          const maxLen = input.max_length || 5000;
          const cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '... (gekürzt)' : cleaned;
        } catch (e: any) {
          return 'FEHLER bei Web-Fetch: ' + (e?.message || 'Netzwerkfehler');
        }
      },
    }),
  }), []);

  const rorkAgent = useRorkAgent({ tools: rorkTools });

  useEffect(() => {
    if (!isRorkProvider || !rorkLoading) return;
    const msgs = rorkAgent.messages ?? [];
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.parts) return;

    const hasUnresolved = lastMsg.parts.some((p: any) =>
      p.type === 'tool' && p.state !== 'output-available' && p.state !== 'output-error'
    );

    if (!hasUnresolved) {
      const timer = setTimeout(() => setRorkLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [rorkAgent.messages, rorkLoading, isRorkProvider]);

  useEffect(() => {
    if (rorkAgent.error) {
      console.log('[Chat] Rork agent error:', rorkAgent.error);
      setError(typeof rorkAgent.error === 'string' ? rorkAgent.error : (rorkAgent.error as any)?.message || 'Studio KI Fehler');
      setRorkLoading(false);
    }
  }, [rorkAgent.error]);

  const convertRorkMessages = useMemo((): ChatMessage[] => {
    if (!isRorkProvider) return [];
    const msgs = rorkAgent.messages ?? [];
    const result: ChatMessage[] = [];

    for (const msg of msgs) {
      if (!msg?.parts) continue;

      const textParts = (msg.parts ?? []).filter((p: any) => p.type === 'text');
      const toolParts = (msg.parts ?? []).filter((p: any) => p.type === 'tool');

      let textContent = textParts.map((p: any) => p.text || '').join('');

      if (msg.role === 'user') {
        const contextEnd = textContent.indexOf('\n---\n');
        if (contextEnd > 0 && contextEnd < 3000) {
          textContent = textContent.slice(contextEnd + 5).trim();
        }
      }

      const { thinking, cleanContent } = parseThinkingFromContent(textContent);

      let thinkingContent = thinking;
      for (const tp of toolParts) {
        if ((tp as any).toolName === 'think') {
          const thought = (tp as any).input?.thought;
          if (thought) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + thought;
          }
        }
      }

      const nonThinkTools = toolParts.filter((p: any) => (p as any).toolName !== 'think');
      const toolCalls: ToolCall[] = nonThinkTools.map((p: any) => ({
        id: (p as any).toolCallId || genId(),
        name: (p as any).toolName || '',
        arguments: (p as any).input || {},
        result: (p as any).state === 'output-available'
          ? (typeof (p as any).output === 'string' ? (p as any).output : JSON.stringify((p as any).output ?? ''))
          : (p as any).state === 'output-error'
            ? ('FEHLER: ' + ((p as any).errorText || 'Unbekannt'))
            : undefined,
        status: ((p as any).state === 'output-available' ? 'completed'
          : (p as any).state === 'output-error' ? 'error'
          : 'running') as ToolCall['status'],
      }));

      const inlineTodos: InlineTodo[] = [];
      for (const tp of toolParts) {
        if ((tp as any).toolName === 'create_todo' && (tp as any).state === 'output-available') {
          try {
            const out = typeof (tp as any).output === 'string' ? JSON.parse((tp as any).output) : (tp as any).output;
            if (out?.id) {
              inlineTodos.push({ id: out.id, text: out.text || (tp as any).input?.text || '', completed: false });
            }
          } catch {
            const text = (tp as any).input?.text || '';
            if (text) inlineTodos.push({ id: genId(), text, completed: false });
          }
        }
      }

      if (msg.role === 'user' && !cleanContent.trim() && toolParts.length === 0) continue;

      result.push({
        id: msg.id || genId(),
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: cleanContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        thinking: thinkingContent || undefined,
        todos: inlineTodos.length > 0 ? inlineTodos : undefined,
        timestamp: Date.now(),
      });
    }

    return result;
  }, [isRorkProvider, rorkAgent.messages]);

  const messages = isRorkProvider ? convertRorkMessages : manualMessages;
  const isLoading = isRorkProvider ? rorkLoading : manualLoading;

  const checkToolPermission = useCallback(async (toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; reason?: string }> => {
    const perm = getToolPermission(toolName);
    console.log('[Chat] Checking permission for', toolName, ':', perm);

    if (perm === 'always') return { allowed: true };

    if (perm === 'removed') {
      return { allowed: false, reason: 'TOOL_HIDDEN' };
    }

    if (perm === 'blocked') {
      return { allowed: false, reason: 'TOOL_BLOCKED: Tool "' + toolName + '" ist vom Nutzer blockiert. Bitte informiere den Nutzer, dass dieses Tool freigeschaltet werden muss.' };
    }

    if (perm === 'ask') {
      return new Promise<{ allowed: boolean; reason?: string }>((resolve) => {
        const reg = TOOL_REGISTRY.find(t => t.name === toolName);
        const approval: PendingToolApproval = {
          id: 'ap_' + Date.now().toString(36),
          toolName,
          toolDisplayName: reg?.displayName || toolName,
          arguments: args,
          resolve: (approved: boolean) => {
            setPendingApproval(null);
            if (approved) {
              resolve({ allowed: true });
            } else {
              resolve({ allowed: false, reason: 'TOOL_REJECTED: Nutzer hat Ausführung von "' + toolName + '" abgelehnt.' });
            }
          },
          timestamp: Date.now(),
        };
        setPendingApproval(approval);
      });
    }

    return { allowed: true };
  }, [getToolPermission]);

  const approvePendingTool = useCallback((approved: boolean) => {
    if (pendingApproval) {
      pendingApproval.resolve(approved);
    }
  }, [pendingApproval]);

  const executeManualTool = useCallback(async (name: string, args: Record<string, any>): Promise<{ result: string; inlineTodos?: InlineTodo[] }> => {
    console.log('[Chat] Executing tool:', name, JSON.stringify(args).slice(0, 200));

    if (name !== 'think') {
      const permCheck = await checkToolPermission(name, args);
      if (!permCheck.allowed) {
        if (permCheck.reason === 'TOOL_HIDDEN') {
          return { result: 'FEHLER: Unbekanntes Tool "' + name + '". Verfügbare Tools: ' + TOOL_REGISTRY.filter(t => {
            const p = settingsRef.current.toolPermissions?.[t.name];
            return p !== 'removed';
          }).map(t => t.name).join(', ') };
        }
        return { result: permCheck.reason || 'Tool nicht erlaubt.' };
      }
    }

    try {
      switch (name) {
        case 'read_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden.' };
          return { result: content };
        }
        case 'read_lines': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden.' };
          const lines = content.split('\n');
          const start = Math.max(0, (args.start_line || 1) - 1);
          const end = Math.min(lines.length, args.end_line || lines.length);
          return { result: lines.slice(start, end).map((l: string, i: number) => (start + i + 1) + ': ' + l).join('\n') };
        }
        case 'write_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          updateFileContent(args.path, args.content ?? '');
          return { result: 'Datei "' + args.path + '" geschrieben (' + (args.content || '').split('\n').length + ' Zeilen).' };
        }
        case 'create_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          createFile(args.path, args.content || '');
          return { result: 'Datei "' + args.path + '" erstellt.' };
        }
        case 'edit_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          if (!args?.old_text) return { result: 'FEHLER: old_text ist leer.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden. Bitte erst mit read_file lesen.' };
          if (!content.includes(args.old_text)) return { result: 'FEHLER: Text nicht gefunden in "' + args.path + '". Bitte Datei erneut mit read_file lesen.' };
          updateFileContent(args.path, content.replace(args.old_text, args.new_text ?? ''));
          return { result: 'Datei "' + args.path + '" bearbeitet.' };
        }
        case 'delete_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          deleteFile(args.path);
          return { result: 'Datei "' + args.path + '" gelöscht.' };
        }
        case 'rename_file': {
          if (!args?.old_path || !args?.new_path) return { result: 'FEHLER: old_path und new_path sind erforderlich.' };
          renameFile(args.old_path, args.new_path);
          return { result: 'Umbenannt: "' + args.old_path + '" → "' + args.new_path + '".' };
        }
        case 'list_directory':
          return { result: listDirectory(args?.path || '') };
        case 'search_files': {
          if (!args?.query) return { result: 'FEHLER: Kein Suchbegriff angegeben.' };
          return { result: searchFilesInProject(args.query, args.path) };
        }
        case 'find_replace': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          if (!args?.find) return { result: 'FEHLER: Suchtext fehlt.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei nicht gefunden.' };
          const count = content.split(args.find).length - 1;
          updateFileContent(args.path, args.all ? content.split(args.find).join(args.replace ?? '') : content.replace(args.find, args.replace ?? ''));
          return { result: count + ' Vorkommen in "' + args.path + '" ersetzt.' };
        }
        case 'create_directory': {
          if (!args?.path) return { result: 'FEHLER: Kein Pfad angegeben.' };
          createDirectory(args.path);
          return { result: 'Verzeichnis "' + args.path + '" erstellt.' };
        }
        case 'get_project_tree':
          return { result: getProjectTree() };
        case 'get_file_info': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          return { result: getFileInfo(args.path) };
        }
        case 'create_todo': {
          if (!args?.text) return { result: 'FEHLER: Todo-Text fehlt.' };
          const id = addTodo(args.text);
          return { result: 'Todo erstellt (ID: ' + id + ')', inlineTodos: [{ id, text: args.text, completed: false }] };
        }
        case 'update_todo': {
          if (!args?.id) return { result: 'FEHLER: Todo-ID fehlt.' };
          updateTodoItem(args.id, args.completed, args.text);
          return { result: 'Todo "' + args.id + '" aktualisiert.' };
        }
        case 'add_memo': {
          if (!args?.content) return { result: 'FEHLER: Memo-Inhalt fehlt.' };
          addMemo(args.content);
          return { result: 'Memo gespeichert.' };
        }
        case 'think':
          return { result: 'Gedankengang verarbeitet.' };
        case 'web_search': {
          if (!args?.query) return { result: 'FEHLER: Suchbegriff fehlt.' };
          try {
            const resp = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(args.query) + '&format=json&no_redirect=1&no_html=1');
            if (!resp.ok) return { result: 'Web-Suche fehlgeschlagen.' };
            const data = await resp.json();
            let results = '';
            if (data?.Abstract) results += data.Abstract + '\n\n';
            if (data?.RelatedTopics) {
              for (const t of (data.RelatedTopics || []).slice(0, 8)) {
                if (t?.Text) results += '• ' + t.Text + '\n';
              }
            }
            return { result: results || 'Keine Ergebnisse für: ' + args.query };
          } catch (e: any) {
            return { result: 'FEHLER: ' + (e?.message || 'Netzwerkfehler') };
          }
        }
        case 'web_fetch': {
          if (!args?.url) return { result: 'FEHLER: URL fehlt.' };
          try {
            const resp = await fetch(args.url);
            if (!resp.ok) return { result: 'Fetch fehlgeschlagen (' + resp.status + ').' };
            const text = await resp.text();
            const maxLen = args.max_length || 5000;
            const cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return { result: cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '...' : cleaned };
          } catch (e: any) {
            return { result: 'FEHLER: ' + (e?.message || 'Netzwerkfehler') };
          }
        }
        default:
          return { result: 'FEHLER: Unbekanntes Tool "' + name + '".' };
      }
    } catch (e: any) {
      console.log('[Chat] Tool error:', name, e);
      return { result: 'FEHLER bei ' + name + ': ' + (e?.message || 'Unbekannt') };
    }
  }, [getFileContent, updateFileContent, createFile, deleteFile, renameFile, createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo, addTodo, updateTodoItem, addMemo, checkToolPermission]);

  const sendMessage = useCallback(async (userText: string, attachedFiles: string[] = []) => {
    if (!userText.trim() && attachedFiles.length === 0) return;

    setError(null);
    setLastFallbackInfo(null);

    if (isRorkProvider) {
      setRorkLoading(true);

      let fullMsg = '';
      if (!rorkContextSentRef.current || (rorkAgent.messages ?? []).length === 0) {
        fullMsg += 'Du bist ein KI-Coding-Assistent in "Studio IDE". Antworte IMMER auf Deutsch.\n';
        fullMsg += 'Nutze deine Tools AKTIV und SOFORT. Frage NICHT ob du etwas tun sollst - TU ES EINFACH.\n';
        fullMsg += 'Lies Dateien IMMER mit read_file BEVOR du sie bearbeitest.\n';
        fullMsg += 'Formatiere Antworten mit Markdown: **fett**, `code`, Listen.\n';
        fullMsg += 'Nutze "think" Tool bei komplexen Aufgaben zum Nachdenken.\n';
        fullMsg += 'Für komplexe Aufgaben: Erst "think" nutzen, dann Plan erstellen, dann alle Schritte ausführen.\n';
        fullMsg += 'Am Ende jeder Nachricht: Fasse verwendete Tools kurz zusammen.\n';
        if (settings.betaWebSearch || settings.yoloMode) {
          fullMsg += 'Du hast das Tool "web_search" verfügbar! Nutze es für Web-Recherche und aktuelle Informationen.\n';
        }
        if (settings.betaWebFetch || settings.yoloMode) {
          fullMsg += 'Du hast das Tool "web_fetch" verfügbar! Nutze es um Webseiten-Inhalte zu laden.\n';
        }
        if (settings.yoloMode) {
          fullMsg += 'YOLO-Modus: Erstelle/bearbeite Dateien OHNE Nachfragen.\n';
        }
        fullMsg += '\nProjektstruktur:\n' + getProjectTree() + '\n';
        fullMsg += '---\n';
        rorkContextSentRef.current = true;
      }

      if (attachedFiles.length > 0) {
        fullMsg += '\nReferenzierte Dateien:\n';
        for (const path of attachedFiles) {
          const content = getFileContent(path);
          fullMsg += '### ' + path + '\n```\n' + (content || '(nicht gefunden)') + '\n```\n';
        }
      }

      fullMsg += userText;

      try {
        rorkAgent.sendMessage(fullMsg);
      } catch (e: any) {
        console.log('[Chat] Rork send error:', e);
        setError(e?.message || 'Fehler beim Senden');
        setRorkLoading(false);
      }
      return;
    }

    abortRef.current = false;
    const currentMessages = manualMessagesRef.current;
    const userMsg: ChatMessage = {
      id: genId(), role: 'user', content: userText, timestamp: Date.now(),
    };
    const newMessages = [...currentMessages, userMsg];
    setManualMessages(newMessages);
    setManualLoading(true);
    setIsThinking(true);
    setThinkingPhase('Analysiere Anfrage...');

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Kein API-Schlüssel. Gehe zu Einstellungen oder wähle "Studio KI" (kostenlos).');
      }

      const mentionedFiles = attachedFiles.map(path => ({
        path, content: getFileContent(path) || '(nicht gefunden)',
      }));

      const systemPrompt = buildSystemPrompt({
        persona: settings.persona, projectTree: getProjectTree(), memos, todos,
        mentionedFiles, yoloMode: settings.yoloMode,
        agentMd: settings.betaAgentLearning ? agentMd : undefined,
        soulMd: settings.betaAgentLearning ? soulMd : undefined,
        betaAgentLearning: settings.betaAgentLearning,
        toolPermissions: settings.toolPermissions,
      });

      const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
      let conversationHistory = [...newMessages];
      let iterations = 0;
      const maxIterations = 15;
      let collectedTodos: InlineTodo[] = [];

      const filteredTools = TOOL_DEFINITIONS.filter(t => {
        if (!settings.yoloMode) {
          if (t.name === 'web_search' && !settings.betaWebSearch) return false;
          if (t.name === 'web_fetch' && !settings.betaWebFetch) return false;
        }
        const perm = getToolPermission(t.name);
        if (perm === 'removed') return false;
        return true;
      });

      while (iterations < maxIterations && !abortRef.current) {
        iterations++;
        setThinkingPhase(iterations === 1 ? 'KI denkt nach...' : 'Verarbeite Tool-Ergebnisse...');

        const response = await callAI(
          settings.selectedProvider as AIProviderType, apiKey, settings.selectedModel,
          conversationHistory, filteredTools, systemPrompt,
          settings.customEndpoint || undefined, fallbackSettings,
        );

        if (response.usedFallback) {
          setLastFallbackInfo('Automatisch gewechselt zu ' + (response.fallbackProvider || 'Fallback'));
        }

        setIsThinking(false);
        const { thinking, cleanContent } = parseThinkingFromContent(response.content || '');

        if (!response.toolCalls || response.toolCalls.length === 0) {
          const assistantMsg: ChatMessage = {
            id: genId(), role: 'assistant', content: cleanContent, timestamp: Date.now(),
            thinking: thinking || undefined,
            todos: collectedTodos.length > 0 ? [...collectedTodos] : undefined,
          };
          conversationHistory = [...conversationHistory, assistantMsg];
          setManualMessages([...conversationHistory]);
          break;
        }

        const toolCalls: ToolCall[] = response.toolCalls.map(tc => ({
          id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
        }));

        const thinkToolCalls = toolCalls.filter(tc => tc.name === 'think');
        let thinkingContent = thinking;
        for (const ttc of thinkToolCalls) {
          if (ttc.arguments?.thought) {
            thinkingContent += (thinkingContent ? '\n\n' : '') + ttc.arguments.thought;
          }
        }

        const assistantMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: cleanContent, toolCalls, timestamp: Date.now(),
          thinking: thinkingContent || undefined,
        };
        conversationHistory = [...conversationHistory, assistantMsg];
        setManualMessages([...conversationHistory]);

        setThinkingPhase('Führe Tools aus...');

        const toolResultMessages: ChatMessage[] = [];
        for (const tc of toolCalls) {
          if (abortRef.current) break;
          tc.status = 'running';
          setManualMessages([...conversationHistory, ...toolResultMessages]);

          const { result, inlineTodos } = await executeManualTool(tc.name, tc.arguments);
          tc.result = result;
          tc.status = result.startsWith('FEHLER') ? 'error' : 'completed';
          if (inlineTodos) collectedTodos = [...collectedTodos, ...inlineTodos];

          toolResultMessages.push({
            id: genId(), role: 'tool', content: result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
          });
        }

        conversationHistory = [...conversationHistory, ...toolResultMessages];
        setManualMessages([...conversationHistory]);
      }

      if (iterations >= maxIterations) {
        setManualMessages(prev => [...prev, {
          id: genId(), role: 'assistant', content: 'Maximale Iterationen erreicht.', timestamp: Date.now(),
        }]);
      }
    } catch (e: any) {
      console.log('[Chat] Error:', e);
      setManualMessages(prev => [...prev, {
        id: genId(), role: 'assistant', content: '❌ ' + (e?.message || 'Unbekannter Fehler'), timestamp: Date.now(),
      }]);
      setError(e?.message || 'Fehler');
    } finally {
      setManualLoading(false);
      setIsThinking(false);
      setThinkingPhase('');
    }
  }, [isRorkProvider, settings, getApiKey, getFallbackSettings, getFileContent, getProjectTree, memos, todos, executeManualTool, rorkAgent, agentMd, soulMd]);

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setManualLoading(false);
    setRorkLoading(false);
    setIsThinking(false);
  }, []);

  const clearChat = useCallback(() => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    }
    setManualMessages([]);
    setError(null);
    setLastFallbackInfo(null);
  }, [isRorkProvider, rorkAgent]);

  const startNewChat = useCallback(() => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    } else {
      const currentMsgs = manualMessagesRef.current;
      if (currentMsgs.length > 0) {
        setManualMessages([{
          id: genId(), role: 'assistant',
          content: '---\n\n**Neuer Chat gestartet.**\n\n---',
          timestamp: Date.now(),
        }]);
      }
    }
    setError(null);
    setLastFallbackInfo(null);
  }, [isRorkProvider, rorkAgent]);

  const compressChat = useCallback(async (): Promise<string | null> => {
    const currentMsgs = isRorkProvider ? convertRorkMessages : manualMessagesRef.current;
    if (currentMsgs.length < 4) return null;

    const summary = currentMsgs
      .filter(m => m.role !== 'tool')
      .map(m => {
        const prefix = m.role === 'user' ? 'Benutzer' : 'KI';
        const toolInfo = m.toolCalls?.length
          ? ' [Tools: ' + m.toolCalls.map(t => t.name).join(', ') + ']' : '';
        return prefix + ': ' + (m.content || '').slice(0, 200) + toolInfo;
      })
      .join('\n');

    return summary;
  }, [isRorkProvider, convertRorkMessages]);

  const applyChatCompression = useCallback((summary: string) => {
    if (isRorkProvider) {
      rorkAgent.setMessages([]);
      rorkContextSentRef.current = false;
    }

    const currentSize = isRorkProvider
      ? JSON.stringify(convertRorkMessages).length
      : JSON.stringify(manualMessagesRef.current).length;
    const newSize = summary.length + 100;

    if (newSize >= currentSize) {
      console.log('[Chat] Compression aborted: new size >= old size');
      return false;
    }

    const summaryMsg: ChatMessage = {
      id: genId(), role: 'user',
      content: '[Zusammenfassung der bisherigen Konversation]\n\n' + summary,
      timestamp: Date.now(),
    };

    if (isRorkProvider) {
      rorkAgent.sendMessage('[Zusammenfassung der bisherigen Konversation]\n\n' + summary);
    } else {
      setManualMessages([summaryMsg]);
    }
    return true;
  }, [isRorkProvider, rorkAgent, convertRorkMessages]);

  return {
    messages, isLoading, isThinking, thinkingPhase, error, lastFallbackInfo,
    sendMessage, stopGeneration, clearChat, startNewChat,
    compressChat, applyChatCompression,
    pendingApproval, approvePendingTool,
  };
});
