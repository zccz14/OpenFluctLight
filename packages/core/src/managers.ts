import { OpenFluctLight } from './core.js';
import { souls, memories, anchors, relationships } from './schema.js';
import { Soul, Memory, MemoryType } from './types.js';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { PREDEFINED_ANCHORS } from './predefined-anchors.js';

/**
 * 灵魂管理器
 */
export class SoulManager {
  constructor(private light: OpenFluctLight) {}

  /**
   * 创建灵魂
   */
  async create(
    name: string,
    metadata?: Record<string, unknown>
  ): Promise<Soul> {
    const soul: Soul = {
      id: randomUUID(),
      name,
      createdAt: new Date(),
      metadata,
    };

    await this.light['orm'].insert(souls).values({
      id: soul.id,
      name: soul.name,
      createdAt: soul.createdAt,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    // 初始化预设锚点
    for (const preset of PREDEFINED_ANCHORS) {
      await this.light['orm'].insert(anchors).values({
        id: randomUUID(),
        soulId: soul.id,
        question: preset.question,
        answer: null,
        source: 'predefined',
        confidence: 0.3,
        lastUpdated: new Date(),
        relatedMemoryIds: JSON.stringify([]),
      });
    }

    return soul;
  }

  /**
   * 获取灵魂
   */
  async get(id: string): Promise<Soul | null> {
    const result = await this.light['orm']
      .select()
      .from(souls)
      .where(eq(souls.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : undefined,
    };
  }

  /**
   * 列出所有灵魂
   */
  async list(): Promise<Soul[]> {
    const results = await this.light['orm'].select().from(souls);

    return results.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : undefined,
    }));
  }

  /**
   * 删除灵魂
   */
  async delete(id: string): Promise<void> {
    await this.light['orm'].delete(souls).where(eq(souls.id, id));
  }
}

/**
 * 记忆管理器
 */
export class MemoryManager {
  constructor(private light: OpenFluctLight) {}

  /**
   * 记住（追加记忆）
   */
  async remember(
    soulId: string,
    content: string,
    options?: {
      type?: MemoryType;
      timestamp?: Date;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Memory> {
    const memory: Memory = {
      id: randomUUID(),
      soulId,
      content,
      type: options?.type || 'experience',
      timestamp: options?.timestamp || new Date(),
      metadata: options?.metadata,
    };

    // 存储到数据库
    await this.light['orm'].insert(memories).values({
      id: memory.id,
      soulId: memory.soulId,
      content: memory.content,
      type: memory.type,
      timestamp: memory.timestamp,
      metadata: memory.metadata ? JSON.stringify(memory.metadata) : null,
    });

    // 生成向量并存储
    const embedding = await this.light.embed(content);
    await this.light['vectorIndex'].insertItem({
      id: memory.id,
      vector: embedding,
      metadata: {
        soulId,
        type: memory.type,
        timestamp: memory.timestamp.toISOString(),
      },
    });

    return memory;
  }

  /**
   * 获取记忆
   */
  async get(id: string): Promise<Memory | null> {
    const result = await this.light['orm']
      .select()
      .from(memories)
      .where(eq(memories.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      soulId: row.soulId,
      content: row.content,
      type: row.type as MemoryType,
      timestamp: row.timestamp,
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : undefined,
    };
  }

  /**
   * 语义搜索记忆
   */
  async search(
    soulId: string,
    query: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<Memory[]> {
    const limit = options?.limit || 20;
    const minSimilarity = options?.minSimilarity || 0.5;

    // 生成查询向量
    const queryVector = await this.light.embed(query);

    // 向量搜索
    const results = await this.light['vectorIndex'].queryItems(
      queryVector,
      query,
      limit * 2
    );

    // 过滤属于该灵魂的记忆
    const filteredResults = results
      .filter(
        (r) => r.item.metadata.soulId === soulId && r.score >= minSimilarity
      )
      .slice(0, limit);

    // 获取完整记忆信息
    const memoryPromises = filteredResults.map((r) => this.get(r.item.id));
    const memoriesWithNull = await Promise.all(memoryPromises);

    return memoriesWithNull.filter((m): m is Memory => m !== null);
  }

  /**
   * 列出灵魂的所有记忆
   */
  async list(
    soulId: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'asc' | 'desc';
    }
  ): Promise<Memory[]> {
    const orderByOption = options?.orderBy || 'asc';

    // 构建基础查询
    const baseQuery = this.light['orm']
      .select()
      .from(memories)
      .where(eq(memories.soulId, soulId));

    // 根据排序选项构建查询
    const orderedQuery =
      orderByOption === 'desc'
        ? baseQuery.orderBy(desc(memories.timestamp))
        : baseQuery.orderBy(memories.timestamp);

    // 应用 limit 和 offset
    let finalQuery = orderedQuery;
    if (options?.limit !== undefined) {
      finalQuery = finalQuery.limit(options.limit) as typeof orderedQuery;
    }
    if (options?.offset !== undefined) {
      finalQuery = finalQuery.offset(options.offset) as typeof orderedQuery;
    }

    const results = await finalQuery;

    return results.map((row) => ({
      id: row.id,
      soulId: row.soulId,
      content: row.content,
      type: row.type as MemoryType,
      timestamp: row.timestamp,
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : undefined,
    }));
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<void> {
    await this.light['orm'].delete(memories).where(eq(memories.id, id));
    await this.light['vectorIndex'].deleteItem(id);
  }
}
