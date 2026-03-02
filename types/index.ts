export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
}

export interface Project {
  id: string;
  name: string;
  projectType: string;
  files: FileNode[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  thinking?: string;
  todos?: InlineTodo[];
}

export interface InlineTodo {
  id: string;
  text: string;
  completed: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export type ToolPermission = 'always' | 'ask' | 'blocked' | 'removed';

export interface ToolPermissionEntry {
  name: string;
  permission: ToolPermission;
}

export interface AppSettings {
  openaiKey: string;
  anthropicKey: string;
  geminiKey: string;
  groqKey: string;
  openrouterKey: string;
  customEndpoint: string;
  customKey: string;
  selectedProvider: string;
  selectedModel: string;
  fontSize: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  yoloMode: boolean;
  persona: string;
  autoRetry: boolean;
  autoFallback: boolean;
  betaHtmlPreview: boolean;
  betaWebSearch: boolean;
  betaWebFetch: boolean;
  betaAgentLearning: boolean;
  betaSuperAgent: boolean;
  toolPermissions: Record<string, ToolPermission>;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface MemoEntry {
  id: string;
  content: string;
  createdAt: number;
}

export type AgentTaskStatus = 'draft' | 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export type AgentTaskType = 'task' | 'thinking' | 'brainstorm' | 'question' | 'web_search';

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: AgentTaskStatus;
  taskType: AgentTaskType;
  subAgentMessages: ChatMessage[];
  result?: string;
  thinkingContent?: string;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface AgentToolUsage {
  name: string;
  count: number;
  status: 'completed' | 'error' | 'mixed';
}

export interface PendingToolApproval {
  id: string;
  toolName: string;
  toolDisplayName: string;
  arguments: Record<string, any>;
  resolve: (approved: boolean) => void;
  timestamp: number;
}

export interface AgentPlan {
  id: string;
  userRequest: string;
  tasks: AgentTask[];
  status: 'planning' | 'review' | 'executing' | 'completed' | 'error';
  summary?: string;
  finalResponse?: string;
  totalToolsUsed?: AgentToolUsage[];
  createdAt: number;
  completedAt?: number;
  dismissed?: boolean;
}

export type AIProviderType = 'rork' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'custom';

export interface AIProviderConfig {
  id: AIProviderType;
  name: string;
  models: { id: string; name: string }[];
  free?: boolean;
  keyHint?: string;
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'rork',
    name: 'Studio KI',
    free: true,
    keyHint: 'Kein Schlüssel nötig – sofort nutzbar!',
    models: [
      { id: 'rork-default', name: 'Studio KI (Gratis)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq ★ Kostenlos',
    free: true,
    keyHint: 'console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Schnell)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini ★ Kostenlos',
    free: true,
    keyHint: 'aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter ★ Kostenlos',
    free: true,
    keyHint: 'openrouter.ai/keys',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Gratis)' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Gratis)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Gratis)' },
    ],
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    models: [
      { id: 'custom', name: 'Eigenes Modell' },
    ],
  },
];

export const PERSONAS: { id: string; name: string; description: string }[] = [
  { id: 'standard', name: 'Standard', description: 'Allgemeiner Coding-Assistent' },
  { id: 'android', name: 'Android-Experte', description: 'Kotlin, Java, Jetpack Compose' },
  { id: 'web', name: 'Web-Entwickler', description: 'TypeScript, React, HTML/CSS' },
  { id: 'python', name: 'Python-Experte', description: 'Python, Django, Data Science' },
  { id: 'fullstack', name: 'Fullstack', description: 'Frontend + Backend + DevOps' },
];

export interface ToolRegistryItem {
  name: string;
  displayName: string;
  description: string;
  category: 'filesystem' | 'planning' | 'analysis' | 'web' | 'memory' | 'system' | 'learning';
  parameters: { name: string; type: string; description: string }[];
  isBeta: boolean;
  defaultPermission: ToolPermission;
}

export const TOOL_REGISTRY: ToolRegistryItem[] = [
  { name: 'read_file', displayName: 'read_file', description: 'Liest den kompletten Inhalt einer Datei.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }], isBeta: false, defaultPermission: 'always' },
  { name: 'read_lines', displayName: 'read_lines', description: 'Liest bestimmte Zeilen einer Datei.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }, { name: 'start_line', type: 'number', description: 'Startzeile' }, { name: 'end_line', type: 'number', description: 'Endzeile' }], isBeta: false, defaultPermission: 'always' },
  { name: 'write_file', displayName: 'write_file', description: 'Schreibt Inhalt in eine Datei (überschreibt komplett).', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }, { name: 'content', type: 'string', description: 'Neuer Inhalt' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'create_file', displayName: 'create_file', description: 'Erstellt eine neue Datei. Ordner werden automatisch erstellt.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }, { name: 'content', type: 'string', description: 'Dateiinhalt' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'edit_file', displayName: 'edit_file', description: 'Bearbeitet eine Datei durch Ersetzen von Text.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }, { name: 'old_text', type: 'string', description: 'Alter Text' }, { name: 'new_text', type: 'string', description: 'Neuer Text' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'delete_file', displayName: 'delete_file', description: 'Löscht eine Datei oder einen leeren Ordner.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'rename_file', displayName: 'rename_file', description: 'Benennt eine Datei oder einen Ordner um.', category: 'filesystem', parameters: [{ name: 'old_path', type: 'string', description: 'Alter Pfad' }, { name: 'new_path', type: 'string', description: 'Neuer Pfad' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'find_replace', displayName: 'find_replace', description: 'Sucht und ersetzt Text in einer Datei.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }, { name: 'find', type: 'string', description: 'Suchtext' }, { name: 'replace', type: 'string', description: 'Ersatztext' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'list_directory', displayName: 'list_directory', description: 'Listet alle Dateien in einem Verzeichnis auf.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'Verzeichnispfad' }], isBeta: false, defaultPermission: 'always' },
  { name: 'search_files', displayName: 'search_files', description: 'Durchsucht Dateien nach Text (grep).', category: 'analysis', parameters: [{ name: 'query', type: 'string', description: 'Suchbegriff' }, { name: 'path', type: 'string', description: 'Optionaler Pfad' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_directory', displayName: 'create_directory', description: 'Erstellt einen neuen Ordner.', category: 'filesystem', parameters: [{ name: 'path', type: 'string', description: 'Ordnerpfad' }], isBeta: false, defaultPermission: 'ask' },
  { name: 'get_project_tree', displayName: 'get_project_tree', description: 'Gibt die gesamte Projektstruktur zurück.', category: 'analysis', parameters: [], isBeta: false, defaultPermission: 'always' },
  { name: 'get_file_info', displayName: 'get_file_info', description: 'Gibt Infos über eine Datei zurück.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }], isBeta: false, defaultPermission: 'always' },
  { name: 'create_todo', displayName: 'create_todo', description: 'Erstellt einen neuen Todo-Eintrag.', category: 'planning', parameters: [{ name: 'text', type: 'string', description: 'Todo-Text' }], isBeta: false, defaultPermission: 'always' },
  { name: 'update_todo', displayName: 'update_todo', description: 'Aktualisiert einen Todo-Eintrag.', category: 'planning', parameters: [{ name: 'id', type: 'string', description: 'Todo-ID' }, { name: 'completed', type: 'boolean', description: 'Status' }], isBeta: false, defaultPermission: 'always' },
  { name: 'add_memo', displayName: 'add_memo', description: 'Speichert eine Notiz im Projektgedächtnis.', category: 'memory', parameters: [{ name: 'content', type: 'string', description: 'Memo-Inhalt' }], isBeta: false, defaultPermission: 'always' },
  { name: 'think', displayName: 'think', description: 'Erweitertes Denken für komplexe Probleme.', category: 'system', parameters: [{ name: 'thought', type: 'string', description: 'Gedankengang' }], isBeta: false, defaultPermission: 'always' },
  { name: 'web_search', displayName: 'web_search', description: 'Web-Suche nach Informationen und Dokumentation.', category: 'web', parameters: [{ name: 'query', type: 'string', description: 'Suchbegriff' }], isBeta: true, defaultPermission: 'ask' },
  { name: 'web_fetch', displayName: 'web_fetch', description: 'Lädt den Inhalt einer Webseite herunter.', category: 'web', parameters: [{ name: 'url', type: 'string', description: 'URL der Webseite' }, { name: 'max_length', type: 'number', description: 'Max. Zeichen' }], isBeta: true, defaultPermission: 'ask' },
  { name: 'read_identity_files', displayName: 'read_identity_files', description: 'Liest alle Identitätsdateien (SOUL.md, AGENTS.md, IDENTITY.md, USER.md, MEMORY.md).', category: 'learning', parameters: [], isBeta: true, defaultPermission: 'always' },
  { name: 'update_soul_md', displayName: 'update_soul_md', description: 'Aktualisiert SOUL.md (Persönlichkeit, Werte, Verhaltensphilosophie des Agenten).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'Neuer Inhalt für SOUL.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_agents_md', displayName: 'update_agents_md', description: 'Aktualisiert AGENTS.md (Verhaltensregeln, Reasoning-Protokoll, Tool-Nutzung).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'Neuer Inhalt für AGENTS.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_identity_md', displayName: 'update_identity_md', description: 'Aktualisiert IDENTITY.md (Name, Rolle, Präsentation des Agenten).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'Neuer Inhalt für IDENTITY.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_user_md', displayName: 'update_user_md', description: 'Aktualisiert USER.md (Nutzer-Profil, Präferenzen, Kommunikationsstil, Projekte).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'Neuer Inhalt für USER.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'update_memory_md', displayName: 'update_memory_md', description: 'Aktualisiert MEMORY.md (Langzeit-Gedächtnis, Entscheidungen, gelernte Präferenzen, Fehler).', category: 'learning', parameters: [{ name: 'content', type: 'string', description: 'Neuer Inhalt für MEMORY.md' }], isBeta: true, defaultPermission: 'always' },
  { name: 'verify_file', displayName: 'verify_file', description: 'Überprüft ob eine Datei existiert und korrekt ist.', category: 'analysis', parameters: [{ name: 'path', type: 'string', description: 'Dateipfad' }], isBeta: false, defaultPermission: 'always' },
  { name: 'task_complete', displayName: 'task_complete', description: 'Markiert eine Agent-Aufgabe als abgeschlossen.', category: 'planning', parameters: [{ name: 'summary', type: 'string', description: 'Zusammenfassung' }], isBeta: false, defaultPermission: 'always' },
];

export const TOOL_CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'filesystem', label: 'Dateisystem', icon: '📁' },
  { id: 'analysis', label: 'Analyse', icon: '🔍' },
  { id: 'planning', label: 'Planung', icon: '📋' },
  { id: 'memory', label: 'Gedächtnis', icon: '💾' },
  { id: 'learning', label: 'Lernen (Beta)', icon: '🧠' },
  { id: 'web', label: 'Web (Beta)', icon: '🌐' },
  { id: 'system', label: 'System', icon: '⚙️' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  openaiKey: '',
  anthropicKey: '',
  geminiKey: '',
  groqKey: '',
  openrouterKey: '',
  customEndpoint: '',
  customKey: '',
  selectedProvider: 'rork',
  selectedModel: 'rork-default',
  fontSize: 14,
  showLineNumbers: true,
  wordWrap: false,
  yoloMode: false,
  persona: 'standard',
  autoRetry: true,
  autoFallback: true,
  betaHtmlPreview: false,
  betaWebSearch: false,
  betaWebFetch: false,
  betaAgentLearning: false,
  betaSuperAgent: false,
  toolPermissions: {},
};

export const PROJECT_TYPES = [
  { id: 'android', name: 'Android (Kotlin)', icon: '📱' },
  { id: 'web', name: 'Web (TypeScript)', icon: '🌐' },
  { id: 'python', name: 'Python', icon: '🐍' },
  { id: 'studio-ide', name: 'Studio IDE (Source)', icon: '🛠️' },
  { id: 'empty', name: 'Leeres Projekt', icon: '📁' },
];
