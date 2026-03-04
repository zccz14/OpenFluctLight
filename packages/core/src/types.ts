/**
 * 灵魂
 */
export interface Soul {
  id: string;
  name: string;
  createdAt: Date;
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

/**
 * 灵魂拷问来源
 */
export type InterrogationSource = 'predefined' | 'auto_discovered';

/**
 * 灵魂拷问
 */
export interface Interrogation {
  id: string;
  soulId: string;
  question: string;
  answer: string | null;
  source: InterrogationSource;
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
  metadata?: Record<string, any>;
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
 * 提问推理结果
 */
export interface QueryResult {
  memories: Memory[];
  interrogations: Array<{
    question: string;
    answer: string | null;
    confidence: number;
  }>;
  relationship?: {
    relatedMemories: Memory[];
    interrogations: Array<{
      question: string;
      answer: string | null;
      confidence: number;
    }>;
  };
}

/**
 * 记忆求索结果
 */
export interface SeekResult {
  contradictions: Contradiction[];
  newInterrogations: Interrogation[];
  updatedInterrogations: Interrogation[];
}
