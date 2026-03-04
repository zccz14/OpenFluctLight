import { OpenFluctLight } from './core';
import { anchors, relationships, memories } from './schema';
import { Anchor, AnchorSource, Relationship, RelationshipTargetType, Memory, Contradiction, SeekResult, RecallResult } from './types';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { MemoryManager } from './managers';

/**
 * 灵魂锚点管理器
 */
export class AnchorManager {
  constructor(private light: OpenFluctLight, private memoryManager: MemoryManager) {}

  /**
   * 创建或更新灵魂锚点
   */
  async ask(
    soulId: string,
    question: string,
    answer: string,
    options?: {
      source?: AnchorSource;
      relatedMemoryIds?: string[];
      confidence?: number;
    }
  ): Promise<Anchor> {
    const anchor: Anchor = {
      id: randomUUID(),
      soulId,
      question,
      answer,
      source: options?.source || 'predefined',
      confidence: options?.confidence || 1.0,
      lastUpdated: new Date(),
      relatedMemoryIds: options?.relatedMemoryIds || [],
    };

    await this.light['orm'].insert(anchors).values({
      id: anchor.id,
      soulId: anchor.soulId,
      question: anchor.question,
      answer: anchor.answer,
      source: anchor.source,
      confidence: anchor.confidence,
      lastUpdated: anchor.lastUpdated,
      relatedMemoryIds: JSON.stringify(anchor.relatedMemoryIds),
    });

    return anchor;
  }

  /**
   * 获取灵魂锚点
   */
  async get(id: string): Promise<Anchor | null> {
    const result = await this.light['orm']
      .select()
      .from(anchors)
      .where(eq(anchors.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      soulId: row.soulId,
      question: row.question,
      answer: row.answer,
      source: row.source as AnchorSource,
      confidence: row.confidence,
      lastUpdated: row.lastUpdated,
      relatedMemoryIds: JSON.parse(row.relatedMemoryIds as string),
    };
  }

  /**
   * 列出灵魂的所有锚点
   */
  async list(soulId: string): Promise<Anchor[]> {
    const results = await this.light['orm']
      .select()
      .from(anchors)
      .where(eq(anchors.soulId, soulId));

    return results.map(row => ({
      id: row.id,
      soulId: row.soulId,
      question: row.question,
      answer: row.answer,
      source: row.source as AnchorSource,
      confidence: row.confidence,
      lastUpdated: row.lastUpdated,
      relatedMemoryIds: JSON.parse(row.relatedMemoryIds as string),
    }));
  }

  /**
   * 更新锚点答案
   */
  async update(id: string, answer: string, confidence?: number): Promise<Anchor> {
    await this.light['orm']
      .update(anchors)
      .set({
        answer,
        confidence: confidence ?? 1.0,
        lastUpdated: new Date(),
      })
      .where(eq(anchors.id, id));

    const updated = await this.get(id);
    if (!updated) throw new Error('Anchor not found after update');
    return updated;
  }

  /**
   * 更新锚点（支持 Create/Update/Delete）
   */
  async updateAnchor(
    soulId: string,
    params: 
      | { action: 'create'; question: string; answer: string | null; source?: AnchorSource; confidence?: number; relatedMemoryIds?: string[] }
      | { action: 'update'; anchorId: string; answer: string; confidence?: number; relatedMemoryIds?: string[] }
      | { action: 'delete'; anchorId: string }
  ): Promise<Anchor | void> {
    if (params.action === 'create') {
      return await this.ask(soulId, params.question, params.answer || '', {
        source: params.source || 'auto_discovered',
        confidence: params.confidence || 0.5,
        relatedMemoryIds: params.relatedMemoryIds || [],
      });
    } else if (params.action === 'update') {
      await this.light['orm']
        .update(anchors)
        .set({
          answer: params.answer,
          confidence: params.confidence ?? 1.0,
          lastUpdated: new Date(),
          relatedMemoryIds: params.relatedMemoryIds ? JSON.stringify(params.relatedMemoryIds) : undefined,
        })
        .where(eq(anchors.id, params.anchorId));
      
      const updated = await this.get(params.anchorId);
      if (!updated) throw new Error('Anchor not found after update');
      return updated;
    } else if (params.action === 'delete') {
      await this.light['orm']
        .delete(anchors)
        .where(eq(anchors.id, params.anchorId));
    }
  }

  /**
   * 检测记忆中的矛盾
   */
  async detectContradictions(soulId: string): Promise<Contradiction[]> {
    // 获取该灵魂的所有记忆
    const allMemories = await this.memoryManager.list(soulId);
    
    if (allMemories.length < 2) return [];

    const contradictions: Contradiction[] = [];

    // 使用 LLM 检测矛盾
    // 分批处理，避免上下文过长
    const batchSize = 20;
    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize);
      
      const prompt = `分析以下记忆片段，找出其中相互矛盾的记忆对。矛盾是指在相似情境下表达了相反的观点、态度或行为倾向。

记忆列表：
${batch.map((m, idx) => `${idx + 1}. [${m.timestamp.toISOString()}] ${m.content}`).join('\n')}

请以 JSON 数组格式返回矛盾对，每个元素包含：
- index1: 第一条记忆的序号
- index2: 第二条记忆的序号
- reason: 矛盾的原因
- suggestedQuestion: 建议的灵魂锚点问题

如果没有发现矛盾，返回空数组 []。`;

      const response = await this.light.complete([
        { role: 'system', content: '你是一个善于发现认知矛盾的哲学家。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3 });

      try {
        const detected = JSON.parse(response);
        for (const item of detected) {
          const mem1 = batch[item.index1 - 1];
          const mem2 = batch[item.index2 - 1];
          if (mem1 && mem2) {
            contradictions.push({
              memory1: mem1,
              memory2: mem2,
              reason: item.reason,
              suggestedQuestion: item.suggestedQuestion,
            });
          }
        }
      } catch (e) {
        // 解析失败，跳过这批
        console.warn('Failed to parse contradiction detection result:', e);
      }
    }

    return contradictions;
  }
}

/**
 * 人际关系管理器
 */
export class RelationshipManager {
  constructor(private light: OpenFluctLight) {}

  /**
   * 建立关系
   */
  async establish(
    soulId: string,
    targetId: string,
    options?: {
      targetType?: RelationshipTargetType;
      metadata?: Record<string, any>;
    }
  ): Promise<Relationship> {
    const relationship: Relationship = {
      id: randomUUID(),
      soulId,
      targetId,
      targetType: options?.targetType || 'external',
      lastInteraction: new Date(),
      metadata: options?.metadata,
    };

    await this.light['orm'].insert(relationships).values({
      id: relationship.id,
      soulId: relationship.soulId,
      targetId: relationship.targetId,
      targetType: relationship.targetType,
      lastInteraction: relationship.lastInteraction,
      metadata: relationship.metadata ? JSON.stringify(relationship.metadata) : null,
    });

    return relationship;
  }

  /**
   * 获取关系
   */
  async get(soulId: string, targetId: string): Promise<Relationship | null> {
    const result = await this.light['orm']
      .select()
      .from(relationships)
      .where(and(eq(relationships.soulId, soulId), eq(relationships.targetId, targetId)))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      soulId: row.soulId,
      targetId: row.targetId,
      targetType: row.targetType as RelationshipTargetType,
      lastInteraction: row.lastInteraction,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }

  /**
   * 列出灵魂的所有关系
   */
  async list(soulId: string): Promise<Relationship[]> {
    const results = await this.light['orm']
      .select()
      .from(relationships)
      .where(eq(relationships.soulId, soulId));

    return results.map(row => ({
      id: row.id,
      soulId: row.soulId,
      targetId: row.targetId,
      targetType: row.targetType as RelationshipTargetType,
      lastInteraction: row.lastInteraction,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    }));
  }

  /**
   * 更新最后互动时间
   */
  async updateInteraction(soulId: string, targetId: string): Promise<void> {
    await this.light['orm']
      .update(relationships)
      .set({ lastInteraction: new Date() })
      .where(and(eq(relationships.soulId, soulId), eq(relationships.targetId, targetId)));
  }
}
