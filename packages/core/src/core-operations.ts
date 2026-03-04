import { OpenFluctLight } from './core.js';
import { MemoryManager } from './managers.js';
import { AnchorManager, RelationshipManager } from './operations.js';
import { SeekResult, RecallResult, Memory } from './types.js';

/**
 * 求索操作
 */
export class Seek {
  constructor(
    private light: OpenFluctLight,
    private memoryManager: MemoryManager,
    private anchorManager: AnchorManager,
    private relationshipManager: RelationshipManager
  ) {}

  /**
   * 执行记忆求索
   */
  async seek(soulId: string): Promise<SeekResult> {
    // 1. 检测矛盾
    const contradictions = await this.anchorManager.detectContradictions(soulId);

    const newAnchors = [];
    const updatedAnchors = [];

    // 2. 处理每个矛盾
    for (const contradiction of contradictions) {
      const { memory1, memory2, suggestedQuestion } = contradiction;

      // 使用辩证法生成答案
      const dialecticAnswer = await this.generateDialecticAnswer(
        memory1,
        memory2,
        suggestedQuestion
      );

      // 检查是否已存在相同问题
      const existingAnchors = await this.anchorManager.list(soulId);
      const existing = existingAnchors.find(i => i.question === suggestedQuestion);

      if (existing) {
        // 更新已有锚点
        const updated = await this.anchorManager.update(
          existing.id,
          dialecticAnswer,
          0.8
        );
        updatedAnchors.push(updated);
      } else {
        // 创建新锚点
        const newAnchor = await this.anchorManager.ask(
          soulId,
          suggestedQuestion,
          dialecticAnswer,
          {
            source: 'auto_discovered',
            relatedMemoryIds: [memory1.id, memory2.id],
            confidence: 0.8,
          }
        );
        newAnchors.push(newAnchor);
      }
    }

    // 3. 更新关系认知
    await this.updateRelationshipAnchors(soulId);

    return {
      contradictions,
      newAnchors,
      updatedAnchors,
    };
  }

  /**
   * 使用辩证法生成答案
   */
  private async generateDialecticAnswer(
    memory1: Memory,
    memory2: Memory,
    question: string
  ): Promise<string> {
    const prompt = `面对以下两段看似矛盾的记忆，请运用辩证法给出一个统一的认知。

记忆1: ${memory1.content}
记忆2: ${memory2.content}

问题: ${question}

请给出一个陈述句形式的答案，体现对立统一的辩证思维。答案应该：
1. 承认两种情况都存在
2. 说明它们在不同情境下的合理性
3. 形成更深层的认知

直接给出答案，不要解释过程。`;

    const answer = await this.light.complete([
      { role: 'system', content: '你是一个善于辩证思考的哲学家，能够在矛盾中找到统一。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.7 });

    return answer.trim();
  }

  /**
   * 更新关系相关的灵魂锚点
   */
  private async updateRelationshipAnchors(soulId: string): Promise<void> {
    // 获取所有关系
    const relationships = await this.relationshipManager.list(soulId);

    for (const rel of relationships) {
      // 获取与该关系相关的记忆
      const relatedMemories = await this.memoryManager.list(soulId);
      const relationshipMemories = relatedMemories.filter(
        m => m.type === 'relationship_note' && 
             m.metadata?.targetId === rel.targetId
      );

      if (relationshipMemories.length === 0) continue;

      // 生成关系相关的锚点
      const questions = [
        `我如何看待 ${rel.targetId}？`,
        `我愿意向 ${rel.targetId} 寻求帮助吗？`,
        `我会将敏感信息告诉 ${rel.targetId} 吗？`,
      ];

      for (const question of questions) {
        // 基于记忆生成答案
        const answer = await this.generateRelationshipAnswer(
          relationshipMemories,
          question
        );

        // 检查是否已存在
        const existingAnchors = await this.anchorManager.list(soulId);
        const existing = existingAnchors.find(i => i.question === question);

        if (existing) {
          await this.anchorManager.update(existing.id, answer, 0.7);
        } else {
          await this.anchorManager.ask(
            soulId,
            question,
            answer,
            {
              source: 'auto_discovered',
              relatedMemoryIds: relationshipMemories.map(m => m.id),
              confidence: 0.7,
            }
          );
        }
      }
    }
  }

  /**
   * 生成关系相关的答案
   */
  private async generateRelationshipAnswer(
    memories: Memory[],
    question: string
  ): Promise<string> {
    const prompt = `基于以下与某人相关的记忆，回答问题。

记忆：
${memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n')}

问题: ${question}

请给出一个陈述句形式的答案，基于记忆中的事实和感受。直接给出答案，不要解释。`;

    const answer = await this.light.complete([
      { role: 'system', content: '你是一个善于理解人际关系的观察者。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.6 });

    return answer.trim();
  }
}

/**
 * 回想操作
 */
export class Recall {
  constructor(
    private light: OpenFluctLight,
    private memoryManager: MemoryManager,
    private anchorManager: AnchorManager,
    private relationshipManager: RelationshipManager
  ) {}

  /**
   * 执行回想
   */
  async recall(
    soulId: string,
    prompt: string,
    contextId?: string,
    options?: {
      memoryLimit?: number;
    }
  ): Promise<RecallResult> {
    const memoryLimit = options?.memoryLimit || 20;

    // 1. 召回相关记忆
    const memories = await this.memoryManager.search(soulId, prompt, {
      limit: memoryLimit,
    });

    // 2. 召回相关灵魂锚点
    const allAnchors = await this.anchorManager.list(soulId);
    const relevantAnchors = await this.findRelevantAnchors(
      prompt,
      allAnchors
    );

    // 3. 如果指定了身份，召回关系信息
    let relationship = undefined;
    if (contextId) {
      const rel = await this.relationshipManager.get(soulId, contextId);
      
      if (rel) {
        // 获取与该关系相关的记忆
        const allMemories = await this.memoryManager.list(soulId);
        const relatedMemories = allMemories.filter(
          m => m.type === 'relationship_note' && 
               m.metadata?.targetId === contextId
        );

        // 获取关系相关的锚点
        const relationshipAnchors = allAnchors.filter(
          i => i.question.includes(contextId)
        );

        relationship = {
          relatedMemories,
          anchors: relationshipAnchors.map(i => ({
            question: i.question,
            answer: i.answer,
            confidence: i.confidence,
          })),
        };
      }
    }

    return {
      memories,
      anchors: relevantAnchors.map(i => ({
        question: i.question,
        answer: i.answer,
        confidence: i.confidence,
      })),
      relationship,
    };
  }

  /**
   * 找到与提问相关的灵魂锚点
   */
  private async findRelevantAnchors(
    prompt: string,
    anchors: any[]
  ): Promise<any[]> {
    if (anchors.length === 0) return [];

    // 使用语义相似度找到相关锚点
    const promptEmbedding = await this.light.embed(prompt);
    
    const withSimilarity = await Promise.all(
      anchors.map(async (i) => {
        const questionEmbedding = await this.light.embed(i.question);
        const similarity = this.cosineSimilarity(promptEmbedding, questionEmbedding);
        return { anchor: i, similarity };
      })
    );

    // 返回相似度 > 0.6 的锚点，最多 10 个
    return withSimilarity
      .filter(item => item.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(item => item.anchor);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
