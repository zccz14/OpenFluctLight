/**
 * 本地 Embedding 服务
 * 使用 node-llama-cpp 和 embeddinggemma-300m-qat-Q8_0 模型
 */
export class LocalEmbedding {
  private static instance: LocalEmbedding;
  private model: unknown = null;
  private context: unknown = null;
  private initPromise: Promise<void> | null = null;
  private initError: Error | null = null;

  private constructor() {}

  static getInstance(): LocalEmbedding {
    if (!LocalEmbedding.instance) {
      LocalEmbedding.instance = new LocalEmbedding();
    }
    return LocalEmbedding.instance;
  }

  /**
   * 初始化模型（首次使用时会下载，约 300MB）
   */
  async initialize(): Promise<void> {
    if (this.model && this.context) return;
    if (this.initError) throw this.initError;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        console.log('正在加载本地 Embedding 模型（首次使用需要下载约 300MB）...');
        
        // 动态导入 node-llama-cpp
        const { getLlama, createModelDownloader } = await import('node-llama-cpp');
        
        // 下载模型
        const downloader = await createModelDownloader({
          modelUri: 'hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/embeddinggemma-300m-qat-Q8_0.gguf',
          showCliProgress: true
        });
        
        const modelPath = await downloader.download();
        
        // 加载模型
        const llama = await getLlama();
        this.model = await llama.loadModel({ modelPath });
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.context = await (this.model as any).createEmbeddingContext();
        console.log('本地 Embedding 模型加载完成');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.initError = new Error(
          `本地 Embedding 模型加载失败: ${errorMessage}\n` +
          '请使用 OpenAI Embedding 服务，或检查 node-llama-cpp 依赖是否正确安装。'
        );
        throw this.initError;
      }
    })();

    await this.initPromise;
  }

  /**
   * 生成文本向量
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.context) {
      throw new Error('Embedding context not initialized');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const embedding = await (this.context as any).getEmbeddingFor(text);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return Array.from((embedding as any).vector as number[]);
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
