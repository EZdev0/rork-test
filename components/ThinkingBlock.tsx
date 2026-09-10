import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react-native';
import { IDE } from '@/constants/colors';

interface Props {
  thinking: string;
  isLive?: boolean;
  phase?: string;
}

const ThinkingBlock = React.memo(({ thinking, isLive, phase }: Props) => {
  const [expanded, setExpanded] = useState<boolean>(!!isLive);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isLive && !expanded) {
      setExpanded(true);
    }
  }, [isLive]);

  useEffect(() => {
    if (isLive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: false }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLive, pulseAnim]);

  useEffect(() => {
    if (isLive && expanded && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }, 50);
    }
  }, [thinking, phase, isLive, expanded]);

  const toggle = useCallback(() => setExpanded(p => !p), []);

  const rawContent = thinking || phase || (isLive ? 'Denkt nach...' : 'Keine Gedanken aufgezeichnet.');
  const displayContent = stripMarkdown(rawContent);
  const hasContent = !!displayContent && displayContent.length > 0;
  const lineCount = displayContent ? displayContent.split('\n').length : 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.header} activeOpacity={0.7}>
        <Animated.View style={[styles.icon, { opacity: pulseAnim }]}>
          <Brain size={14} color={IDE.keyword} />
        </Animated.View>
        <Text style={styles.label} numberOfLines={1}>
          {isLive ? (phase || 'Denkt nach...') : 'Erweitertes Denken'}
        </Text>
        {!isLive && lineCount > 0 ? (
          <Text style={styles.lengthBadge}>{lineCount} Zeilen</Text>
        ) : null}
        {isLive && (
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        <View style={styles.chevron}>
          {expanded ? <ChevronDown size={14} color={IDE.muted} /> : <ChevronRight size={14} color={IDE.muted} />}
        </View>
      </TouchableOpacity>

      {expanded ? (
        <ScrollView
          ref={scrollRef}
          style={styles.contentScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.content}>
            <Text style={styles.thinkingText}>{displayContent}</Text>
            {isLive && <Animated.View style={[styles.cursor, { opacity: pulseAnim }]} />}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';

function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export default ThinkingBlock;

const styles = StyleSheet.create({
  container: {
    backgroundColor: IDE.keyword + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.keyword + '25',
    marginVertical: 6,
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IDE.keyword + '20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: IDE.keyword,
    flex: 1,
  },
  lengthBadge: {
    fontSize: 10,
    color: IDE.muted,
    backgroundColor: IDE.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.keyword + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IDE.keyword,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.keyword,
    letterSpacing: 0.5,
  },
  chevron: {
    marginLeft: 4,
  },
  contentScroll: {
    maxHeight: 200,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: IDE.keyword + '20',
    padding: 10,
    backgroundColor: IDE.bg + 'CC',
  },
  thinkingText: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  cursor: {
    width: 6,
    height: 14,
    backgroundColor: IDE.keyword,
    borderRadius: 1,
    marginTop: 4,
  },
});
