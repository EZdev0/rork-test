import { Platform, Alert } from 'react-native';
import JSZip from 'jszip';
import { FileNode, Project } from '@/types';

export interface FlatFile {
  path: string;
  content: string;
}

export function flattenFiles(nodes: FileNode[], basePath: string = ''): FlatFile[] {
  const result: FlatFile[] = [];
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of sorted) {
    const path = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ path, content: node.content ?? '' });
    }
    if (node.type === 'directory' && node.children) {
      result.push(...flattenFiles(node.children, path));
    }
  }
  return result;
}

function collectDirectories(nodes: FileNode[], basePath: string = ''): string[] {
  const dirs: string[] = [];
  for (const node of nodes) {
    if (node.type === 'directory') {
      const path = basePath ? `${basePath}/${node.name}` : node.name;
      dirs.push(path);
      if (node.children) {
        dirs.push(...collectDirectories(node.children, path));
      }
    }
  }
  return dirs;
}

export function generateProjectBundle(project: Project): string {
  const files = flattenFiles(project.files);
  const divider = '═'.repeat(64);
  const now = new Date().toISOString();

  let bundle = '';
  bundle += `╔${divider}╗\n`;
  bundle += `║  Project: ${project.name.padEnd(52)}║\n`;
  bundle += `║  Type:    ${project.projectType.padEnd(52)}║\n`;
  bundle += `║  Files:   ${String(files.length).padEnd(52)}║\n`;
  bundle += `║  Export:  ${now.padEnd(52)}║\n`;
  bundle += `╚${divider}╝\n\n`;

  bundle += `DIRECTORY STRUCTURE:\n`;
  bundle += generateTreeView(project.files, '');
  bundle += '\n\n';

  for (const file of files) {
    bundle += `${'─'.repeat(64)}\n`;
    bundle += `📄 ${file.path}\n`;
    bundle += `${'─'.repeat(64)}\n`;
    bundle += file.content;
    if (!file.content.endsWith('\n')) bundle += '\n';
    bundle += '\n';
  }

  bundle += `${'━'.repeat(64)}\n`;
  bundle += `END OF EXPORT — ${files.length} files exported\n`;

  return bundle;
}

function generateTreeView(nodes: FileNode[], indent: string): string {
  let result = '';
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const isLast = i === sorted.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    const childIndent = isLast ? '    ' : '│   ';

    if (node.type === 'directory') {
      result += `${indent}${prefix}📁 ${node.name}/\n`;
      if (node.children && node.children.length > 0) {
        result += generateTreeView(node.children, indent + childIndent);
      }
    } else {
      result += `${indent}${prefix}${node.name}\n`;
    }
  }
  return result;
}

export function generateProjectJson(project: Project): string {
  const files = flattenFiles(project.files);
  return JSON.stringify({
    name: project.name,
    type: project.projectType,
    exportedAt: new Date().toISOString(),
    version: '1.0',
    files: files.map(f => ({ path: f.path, content: f.content })),
  }, null, 2);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').toLowerCase();
}

async function buildZipBlob(project: Project): Promise<Blob> {
  const zip = new JSZip();
  const rootFolder = sanitizeFilename(project.name);

  const dirs = collectDirectories(project.files);
  for (const dirPath of dirs) {
    zip.folder(`${rootFolder}/${dirPath}`);
  }

  const files = flattenFiles(project.files);
  for (const file of files) {
    zip.file(`${rootFolder}/${file.path}`, file.content);
  }

  console.log('[Download] Building ZIP with', files.length, 'files and', dirs.length, 'directories');

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  console.log('[Download] ZIP created, size:', Math.round(blob.size / 1024), 'KB');
  return blob;
}

async function buildZipBase64(project: Project): Promise<string> {
  const zip = new JSZip();
  const rootFolder = sanitizeFilename(project.name);

  const dirs = collectDirectories(project.files);
  for (const dirPath of dirs) {
    zip.folder(`${rootFolder}/${dirPath}`);
  }

  const files = flattenFiles(project.files);
  for (const file of files) {
    zip.file(`${rootFolder}/${file.path}`, file.content);
  }

  console.log('[Download] Building ZIP (base64) with', files.length, 'files');

  const base64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return base64;
}

async function downloadWebBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    console.log('[Download] Web blob download triggered:', filename);
    return true;
  } catch (e) {
    console.log('[Download] Web blob download error:', e);
    return false;
  }
}

async function downloadWeb(content: string, filename: string, mimeType: string = 'text/plain'): Promise<boolean> {
  try {
    const blob = new Blob([content], { type: mimeType });
    return downloadWebBlob(blob, filename);
  } catch (e) {
    console.log('[Download] Web download error:', e);
    return false;
  }
}

async function downloadNativeZip(project: Project, filename: string): Promise<boolean> {
  try {
    const base64 = await buildZipBase64(project);

    const FileSystemModule = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const FS = FileSystemModule.default ?? FileSystemModule;

    const fileUri = ((FS as any).cacheDirectory ?? '') + filename;
    await (FS as any).writeAsStringAsync(fileUri, base64, {
      encoding: (FS as any).EncodingType.Base64,
    });
    console.log('[Download] ZIP written to:', fileUri);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/zip',
        dialogTitle: 'Projekt exportieren',
        UTI: 'public.zip-archive',
      });
      console.log('[Download] ZIP shared successfully');
      return true;
    } else {
      Alert.alert('Hinweis', 'Teilen ist auf diesem Gerät nicht verfügbar.');
      return false;
    }
  } catch (e) {
    console.log('[Download] Native ZIP download error:', e);
    return false;
  }
}

async function downloadNative(content: string, filename: string, mimeType: string): Promise<boolean> {
  try {
    const FileSystemModule = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const FS = FileSystemModule.default ?? FileSystemModule;

    const fileUri = ((FS as any).cacheDirectory ?? '') + filename;
    await (FS as any).writeAsStringAsync(fileUri, content, {
      encoding: (FS as any).EncodingType.UTF8,
    });
    console.log('[Download] File written to:', fileUri);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType,
        dialogTitle: 'Projekt exportieren',
        UTI: filename.endsWith('.json') ? 'public.json' : 'public.plain-text',
      });
      console.log('[Download] Shared successfully');
      return true;
    } else {
      Alert.alert('Hinweis', 'Teilen ist auf diesem Gerät nicht verfügbar.');
      return false;
    }
  } catch (e) {
    console.log('[Download] Native download error:', e);
    return false;
  }
}

export async function exportProjectAsZip(project: Project): Promise<boolean> {
  // VALIDIERUNG: Projekt muss existieren
  if (!project) {
    console.log('[Download] ERROR: Kein Projekt zum Exportieren vorhanden');
    if (typeof Alert !== 'undefined') {
      Alert.alert('Export nicht möglich', 'Kein Projekt ausgewählt. Bitte erstelle oder öffne ein Projekt.');
    }
    return false;
  }

  // VALIDIERUNG: Mindestens eine Datei required
  const allFiles = flattenFiles(project.files);
  if (allFiles.length === 0) {
    console.log('[Download] ERROR: Projekt hat keine Dateien');
    if (typeof Alert !== 'undefined') {
      Alert.alert('Export nicht möglich', 'Das Projekt enthält keine Dateien. Bitte erstelle zuerst Dateien.');
    }
    return false;
  }

  const filename = `${sanitizeFilename(project.name)}.zip`;

  if (Platform.OS === 'web') {
    try {
      const blob = await buildZipBlob(project);
      return downloadWebBlob(blob, filename);
    } catch (e) {
      console.log('[Download] ZIP web export error:', e);
      if (typeof Alert !== 'undefined') {
        Alert.alert('Export fehlgeschlagen', 'Ein Fehler ist beim Export aufgetreten: ' + (e as Error).message);
      }
      return false;
    }
  } else {
    return downloadNativeZip(project, filename);
  }
}

export async function exportProjectAsText(project: Project): Promise<boolean> {
  const bundle = generateProjectBundle(project);
  const filename = `${sanitizeFilename(project.name)}-export.txt`;

  if (Platform.OS === 'web') {
    return downloadWeb(bundle, filename, 'text/plain;charset=utf-8');
  } else {
    return downloadNative(bundle, filename, 'text/plain');
  }
}

export async function exportProjectAsJson(project: Project): Promise<boolean> {
  const json = generateProjectJson(project);
  const filename = `${sanitizeFilename(project.name)}-export.json`;

  if (Platform.OS === 'web') {
    return downloadWeb(json, filename, 'application/json');
  } else {
    return downloadNative(json, filename, 'application/json');
  }
}

export function countProjectFiles(files: FileNode[]): { files: number; dirs: number; totalChars: number } {
  let fileCount = 0;
  let dirCount = 0;
  let totalChars = 0;

  function walk(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        fileCount++;
        totalChars += (node.content ?? '').length;
      } else if (node.type === 'directory') {
        dirCount++;
        if (node.children) walk(node.children);
      }
    }
  }
  walk(files);
  return { files: fileCount, dirs: dirCount, totalChars };
}
