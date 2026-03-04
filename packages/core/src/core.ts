import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { SoulManager, MemoryManager } from './managers';
import { InterrogationManager, RelationshipManager } from './operations';
import { QuestionSeek, QueryInference } from './core-operations';

export interface OpenFluctLightConfig {
  dataPath: string;
  openaiApiKey?: string;
  openaiBaseURL?: string;
  embeddingModel?: string;
}

/**
 * OpenFluctLight 主类
 */
export class OpenFluctLight {
  private db: Database.Database;
  private orm: ReturnType<typeof drizzle>;
  private vectorIndex: LocalIndex;
  private openai: OpenAI;
  private config: Required<OpenFluctLightConfig>;

  // 管理器
  public souls: SoulManager;
  public memories: MemoryManager;
  public interrogations: InterrogationManager;
  public relationships: RelationshipManager;
  
  // 核心操作
  public questionSeek: QuestionSeek;
  public queryInference: QueryInference;

  constructor(config: OpenFluctLightConfig) {
    this.config = {
      dataPath: config.dataPath,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
      openaiBaseURL: config.openaiBaseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
    };

    // 确保数据目录存在
    if (!fs.existsSync(this.config.dataPath)) {
      fs.mkdirSync(this.config.dataPath, { recursive: true });
    }

    // 初始化 SQLite
    const dbPath = path.join(this.config.dataPath, 'soul.db');
    this.db = new Database(dbPath);
    this.orm = drizzle(this.db, { schema });

    // 初始化向量索引
    const vectorPath = path.join(this.config.dataPath, 'vectors');
    this.vectorIndex = new LocalIndex(vectorPath);

    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey: this.config.openaiApiKey,
      baseURL: this.config.openaiBaseURL,
    });

    // 初始化管理器
    this.souls = new SoulManager(this);
    this.memories = new MemoryManager(this);
    this.interrogations = new InterrogationManager(this, this.memories);
    this.relationships = new RelationshipManager(this);
    
    // 初始化核心操作
    this.questionSeek = new QuestionSeek(this, this.memories, this.interrogations, this.relationships);
    this.queryInference = new QueryInference(this, this.memories, this.interrogations, this.relationships);
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    // 创建表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS souls (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (soul_id) REFERENCES souls(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interrogations (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        source TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        last_updated INTEGER NOT NULL,
        related_memory_ids TEXT NOT NULL,
        FOREIGN KEY (soul_id) REFERENCES souls(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        soul_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        last_interaction INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (soul_id) REFERENCES souls(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_memories_soul_id ON memories(soul_id);
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
      CREATE INDEX IF NOT EXISTS idx_interrogations_soul_id ON interrogations(soul_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_soul_id ON relationships(soul_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(soul_id, target_id);
    `);

    // 初始化向量索引
    if (!(await this.vectorIndex.isIndexCreated())) {
      await this.vectorIndex.createIndex();
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.db.close();
  }

  /**
   * 生成文本嵌入向量
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * 调用 LLM
   */
  async complete(messages: Array<{ role: string; content: string }>, options?: {
    model?: string;
    temperature?: number;
  }): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: options?.model || 'gpt-4o-mini',
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
    });
    return response.choices[0].message.content || '';
  }
}
