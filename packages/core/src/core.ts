import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { LocalIndex } from 'vectra';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { SoulManager, MemoryManager } from './managers.js';
import { AnchorManager, RelationshipManager } from './operations.js';
import { Recall } from './core-operations.js';
import { Chat } from './chat.js';
import { LocalEmbedding } from './local-embedding.js';

export interface OpenFluctLightConfig {
  dataPath: string;

  // LLM 配置（用于对话生成）
  llmApiKey?: string;
  llmBaseURL?: string;
  llmModel?: string;

  // Embedding 配置
  useLocalEmbedding?: boolean; // 是否使用本地 Embedding
  embeddingApiKey?: string; // Embedding API Key（当不使用本地模型时）
  embeddingBaseURL?: string; // Embedding Base URL
  embeddingModel?: string; // Embedding 模型名称

  // 兼容旧配置
  openaiApiKey?: string;
  openaiBaseURL?: string;
}

/**
 * OpenFluctLight 主类
 */
export class OpenFluctLight {
  private db: Database.Database;
  private orm: ReturnType<typeof drizzle>;
  private vectorIndex: LocalIndex;
  private openai!: OpenAI;
  private embeddingClient!: OpenAI;
  private localEmbedding: LocalEmbedding | null = null;
  private config: Required<OpenFluctLightConfig>;

  // 管理器
  public souls: SoulManager;
  public memories: MemoryManager;
  public anchors: AnchorManager;
  public relationships: RelationshipManager;

  // 核心操作
  public recall: Recall;

  // 高级操作
  public chat: Chat;

  constructor(config: OpenFluctLightConfig) {
    this.config = {
      dataPath: config.dataPath,

      // LLM 配置（优先使用新配置，兼容旧配置）
      llmApiKey:
        config.llmApiKey ||
        config.openaiApiKey ||
        process.env.OPENAI_API_KEY ||
        '',
      llmBaseURL:
        config.llmBaseURL ||
        config.openaiBaseURL ||
        process.env.OPENAI_BASE_URL ||
        'https://api.openai.com/v1',
      llmModel: config.llmModel || 'gpt-4o-mini',

      // Embedding 配置
      useLocalEmbedding: config.useLocalEmbedding || false,
      embeddingApiKey:
        config.embeddingApiKey ||
        config.openaiApiKey ||
        process.env.OPENAI_API_KEY ||
        '',
      embeddingBaseURL:
        config.embeddingBaseURL ||
        config.openaiBaseURL ||
        process.env.OPENAI_BASE_URL ||
        'https://api.openai.com/v1',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',

      // 兼容旧配置
      openaiApiKey:
        config.openaiApiKey ||
        config.llmApiKey ||
        process.env.OPENAI_API_KEY ||
        '',
      openaiBaseURL:
        config.openaiBaseURL ||
        config.llmBaseURL ||
        process.env.OPENAI_BASE_URL ||
        'https://api.openai.com/v1',
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

    // 初始化 Embedding 服务
    if (this.config.useLocalEmbedding) {
      this.localEmbedding = LocalEmbedding.getInstance();
    } else if (this.config.embeddingApiKey) {
      // 初始化独立的 Embedding 客户端
      this.embeddingClient = new OpenAI({
        apiKey: this.config.embeddingApiKey,
        baseURL: this.config.embeddingBaseURL,
      });
    }

    // 初始化 OpenAI 客户端（用于 LLM 对话）
    if (this.config.llmApiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.llmApiKey,
        baseURL: this.config.llmBaseURL,
      });
    }

    // 初始化管理器
    this.souls = new SoulManager(this);
    this.memories = new MemoryManager(this);
    this.anchors = new AnchorManager(this, this.memories);
    this.relationships = new RelationshipManager(this);

    // 初始化核心操作
    this.recall = new Recall(
      this,
      this.memories,
      this.anchors,
      this.relationships
    );

    // 初始化高级操作
    this.chat = new Chat(this);
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

      CREATE TABLE IF NOT EXISTS anchors (
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
      CREATE INDEX IF NOT EXISTS idx_anchors_soul_id ON anchors(soul_id);
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
    if (this.config.useLocalEmbedding && this.localEmbedding) {
      return await this.localEmbedding.embed(text);
    } else {
      if (!this.embeddingClient) {
        throw new Error(
          'Embedding API key is required. Please provide embeddingApiKey in the config.'
        );
      }
      const response = await this.embeddingClient.embeddings.create({
        model: this.config.embeddingModel,
        input: text,
      });
      return response.data[0].embedding;
    }
  }

  /**
   * 调用 LLM
   */
  async complete(
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<string> {
    if (!this.openai) {
      throw new Error(
        'LLM API key is required for chat completions. Please provide llmApiKey in the config.'
      );
    }

    const response = await this.openai.chat.completions.create({
      model: options?.model || this.config.llmModel,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
    });
    return response.choices[0].message.content || '';
  }
}
