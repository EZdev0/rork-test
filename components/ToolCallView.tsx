import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight, Check, X, Loader2, Wrench } from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { ToolCall } from '@/types';

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Datei lesen',
  read_lines: 'Zeilen lesen',
  write_file: 'Datei schreiben',
  create_file: 'Datei erstellen',
  edit_file: 'Datei bearbeiten',
  delete_file: 'Datei löschen',
  rename_file: 'Datei umbenennen',
  list_directory: 'Verzeichnis auflisten',
  search_files: 'Dateien durchsuchen',
  find_replace: 'Suchen & Ersetzen',
  create_directory: 'Ordner erstellen',
  get_project_tree: 'Projektstruktur',
  get_file_info: 'Datei-Info',
  create_todo: 'Todo erstellen',
  update_todo: 'Todo aktualisieren',
  add_memo: 'Memo speichern',
  web_search: 'Web-Suche',
  web_fetch: 'Webseite laden',
  think: 'Nachdenken',
  task_complete: 'Aufgabe abgeschlossen',
  verify_file: 'Datei überprüfen',
};

interface Props {
  toolCall: ToolCall;
}

const ToolCallView = React.memo(({ toolCall }: Props) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const toggle = useCallback(() => setExpanded(p => !p), []);

  const statusColor = toolCall.status === 'completed' ? IDE.accent
    : toolCall.status === 'error' ? IDE.danger
    : IDE.warning;

  const StatusIcon = toolCall.status === 'completed' ? Check
    : toolCall.status === 'error' ? X
    : Loader2;

  const label = TOOL_LABELS[toolCall.name] || toolCall.name;

  const argsStr = Object.entries(toolCall.arguments || {})
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? (v.length > 60 ? v.slice(0, 60) + '...' : v) : JSON.stringify(v);
      return k + ': ' + val;
    })
    .join('\n');

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]}>
          <StatusIcon size={10} color="#fff" />
        </View>
        <Wrench size={12} color={IDE.muted} style={styles.toolIcon} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {toolCall.arguments?.path ? (
          <Text style={styles.path} numberOfLines={1}>{toolCall.arguments.path}</Text>
        ) : null}
        <View style={styles.chevron}>
          {expanded ? <ChevronDown size={12} color={IDE.muted} /> : <ChevronRight size={12} color={IDE.muted} />}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          {argsStr ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Parameter</Text>
              <Text style={styles.mono}>{argsStr}</Text>
            </View>
          ) : null}
          {toolCall.result ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ergebnis</Text>
              <Text style={[styles.mono, toolCall.status === 'error' && styles.errorText]} numberOfLines={20}>
                {toolCall.result.length > 500 ? toolCall.result.slice(0, 500) + '...' : toolCall.result}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
});

ToolCallView.displayName = 'ToolCallView';

export default ToolCallView;

const styles = StyleSheet.create({
  container: {
    backgroundColor: IDE.bg + 'CC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IDE.border,
    marginVertical: 4,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  toolIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.text,
    flexShrink: 0,
  },
  path: {
    fontSize: 11,
    color: IDE.muted,
    marginLeft: 6,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto' as const,
    paddingLeft: 8,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 10,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: IDE.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mono: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  errorText: {
    color: IDE.danger,
  },
});
