/**
 * 灵魂
 */
export interface Soul {
  id: string;
  name: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 记忆类型
 */
export type MemoryType = 'experience' | 'knowledge' | 'conversation' | 'relationship_note';

/**
 * 记忆
 */
export interface Memory {
  id: string;
  soulId: string;
  content: string;
  type: MemoryType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 灵魂锚点来源
 */
export type AnchorSource = 'predefined' | 'auto_discovered';

/**
 * 灵魂锚点
 */
export interface Anchor {
  id: string;
  soulId: string;
  question: string;
  answer: string | null;
  source: AnchorSource;
  confidence: number;
  lastUpdated: Date;
  relatedMemoryIds: string[];
}

/**
 * 关系目标类型
 */
export type RelationshipTargetType = 'soul' | 'external';

/**
 * 人际关系
 */
export interface Relationship {
  id: string;
  soulId: string;
  targetId: string;
  targetType: RelationshipTargetType;
  lastInteraction: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 矛盾对
 */
export interface Contradiction {
  memory1: Memory;
  memory2: Memory;
  reason: string;
  suggestedQuestion: string;
}

/**
 * 召回的锚点信息
 */
export interface RecalledAnchor {
  id: string;
  question: string;
  answer: string | null;
  confidence: number;
}

/**
 * 回想结果
 */
export interface RecallResult {
  memories: Memory[];
  anchors: RecalledAnchor[];
  relationship?: {
    relatedMemories: Memory[];
    anchors: RecalledAnchor[];
  };
}

/**
 * 求索结果
 */
export interface SeekResult {
  contradictions: Contradiction[];
  newAnchors: Anchor[];
  updatedAnchors: Anchor[];
}
