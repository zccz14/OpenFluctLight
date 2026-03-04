import { pipeline } from '@xenova/transformers';

/**
 * 本地 Embedding 服务
 * 使用 Transformers.js 和 all-MiniLM-L6-v2 模型
 */
export class LocalEmbedding {
  private static instance: LocalEmbedding;
  private embedder: any = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): LocalEmbedding {
    if (!LocalEmbedding.instance) {
      LocalEmbedding.instance = new LocalEmbedding();
    }
    return LocalEmbedding.instance;
  }

  /**
   * 初始化模型（首次使用时会下载，约 23MB）
   */
  async initialize(): Promise<void> {
    if (this.embedder) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      console.log('正在加载本地 Embedding 模型（首次使用需要下载约 23MB）...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      console.log('本地 Embedding 模型加载完成');
    })();

    await this.initPromise;
  }

  /**
   * 生成文本向量
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // 转换为普通数组
    return Array.from(output.data);
  }

  /**
   * 批量生成向量
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();
    
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
