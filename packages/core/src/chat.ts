import { OpenFluctLight } from './core.js';
import { Anchor, Memory, RecallResult, RecalledAnchor } from './types.js';

export interface ChatOptions {
  contextId?: string;  // 对话对象的身份
  userName?: string;   // 用户名称
  verbose?: boolean;   // 是否输出详细日志
}

export interface ChatResult {
  response: string;
  updatedAnchors?: Anchor[];
  recalled: {
    memories: Memory[];
    anchors: RecalledAnchor[];
  };
}

interface LLMResponse {
  response: string;
  needsUpdate: boolean;
  awareness?: string;
  updates?: Array<{
    action: 'create' | 'update';
    anchorId?: string;
    question?: string;
    answer: string;
    reasoning: string;
  }>;
}

/**
 * Chat 高级操作
 */
export class Chat {
  constructor(private light: OpenFluctLight) {}

  async chat(
    soulId: string,
    userInput: string,
    options?: ChatOptions
  ): Promise<ChatResult> {
    const userName = options?.userName || '用户';
    const contextId = options?.contextId;
    const verbose = options?.verbose || false;

    if (verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('📝 [步骤 1] 记录用户输入');
      console.log('='.repeat(60));
    }

    // 1. Remember 用户输入
    await this.light.memories.remember(soulId, `${userName}说：${userInput}`, {
      type: 'conversation',
      metadata: { speaker: userName, role: 'user' }
    });

    if (verbose) {
      console.log(`✓ 已记录: ${userName}说：${userInput}\n`);
      console.log('='.repeat(60));
      console.log('🔍 [步骤 2] 召回相关记忆和锚点');
      console.log('='.repeat(60));
    }

    // 2. Recall 召回认知
    const recalled = await this.light.recall.recall(soulId, userInput, contextId);

    if (verbose) {
      console.log(`\n📚 召回了 ${recalled.memories.length} 条记忆:`);
      recalled.memories.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.content} (${m.timestamp.toISOString()})`);
      });
      console.log(`\n⚓ 召回了 ${recalled.anchors.length} 个锚点:`);
      recalled.anchors.forEach((a, i) => {
        console.log(`  ${i + 1}. "${a.question}"`);
        console.log(`     → ${a.answer || '(未回答)'} (置信度: ${a.confidence.toFixed(2)})`);
      });
    }

    if (verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('🤖 [步骤 3] 调用 LLM 生成回复');
      console.log('='.repeat(60));
    }

    // 3. LLM 判断
    const llmResult = await this.generateLLMResponse(
      soulId,
      userInput,
      userName,
      recalled,
      verbose
    );

    if (verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('💾 [步骤 4] 记录 AI 回复');
      console.log('='.repeat(60));
    }

    // 4. Remember AI 回复
    await this.light.memories.remember(soulId, `我回复${userName}：${llmResult.response}`, {
      type: 'conversation',
      metadata: { speaker: 'self', role: 'assistant', targetUser: userName }
    });

    if (verbose) {
      console.log(`✓ 已记录: 我回复${userName}：${llmResult.response}\n`);
    }

    // 5. UpdateAnchor（条件性）
    const updatedAnchors: Anchor[] = [];
    if (llmResult.needsUpdate && llmResult.updates) {
      if (verbose) {
        console.log('='.repeat(60));
        console.log('🔄 [步骤 5] 更新锚点');
        console.log('='.repeat(60));
        console.log(`需要更新 ${llmResult.updates.length} 个锚点:\n`);
      }

      for (const update of llmResult.updates) {
        let result: Anchor | void = undefined;
        
        if (update.action === 'create') {
          if (verbose) {
            console.log(`  ➕ 创建新锚点: "${update.question}"`);
            console.log(`     答案: ${update.answer}`);
            console.log(`     原因: ${update.reasoning}`);
          }
          result = await this.light.anchors.updateAnchor(soulId, {
            action: 'create',
            question: update.question!,
            answer: update.answer,
            source: 'auto_discovered',
          });
        } else if (update.action === 'update') {
          if (verbose) {
            console.log(`  ✏️  更新锚点: ${update.anchorId}`);
            console.log(`     新答案: ${update.answer}`);
            console.log(`     原因: ${update.reasoning}`);
          }
          result = await this.light.anchors.updateAnchor(soulId, {
            action: 'update',
            anchorId: update.anchorId!,
            answer: update.answer,
          });
        }
        
        if (result) {
          updatedAnchors.push(result);
        }
      }
    }

    // 6. Remember 认知更新（可选）
    if (llmResult.needsUpdate && llmResult.awareness) {
      if (verbose) {
        console.log('\n' + '='.repeat(60));
        console.log('💡 [步骤 6] 记录自我意识');
        console.log('='.repeat(60));
        console.log(`意识到: ${llmResult.awareness}\n`);
      }
      await this.light.memories.remember(soulId, llmResult.awareness, {
        type: 'experience',
        metadata: { category: 'self-awareness' }
      });
    }

    if (verbose) {
      console.log('='.repeat(60));
      console.log('✅ 对话处理完成');
      console.log('='.repeat(60) + '\n');
    }

    return {
      response: llmResult.response,
      updatedAnchors: updatedAnchors.length > 0 ? updatedAnchors : undefined,
      recalled: {
        memories: recalled.memories,
        anchors: recalled.anchors,
      }
    };
  }

  private async generateLLMResponse(
    soulId: string,
    userInput: string,
    userName: string,
    recalled: RecallResult,
    verbose: boolean = false
  ): Promise<LLMResponse> {
    // 获取灵魂信息
    const soul = await this.light.souls.get(soulId);
    const soulName = soul?.name || '灵魂';

    // 获取最近的对话记忆（最近10条）
    const recentMemories = await this.light.memories.list(soulId, {
      limit: 10,
      orderBy: 'desc'
    });
    
    // 过滤出对话类型的记忆，并按时间正序排列
    const recentConversations = recentMemories
      .filter(m => m.type === 'conversation')
      .reverse(); // 从旧到新排列

    const recentConversationsText = recentConversations
      .map((m: Memory) => `- ${m.content}`)
      .join('\n');

    // 构建 prompt
    const memoriesText = recalled.memories
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((m: Memory) => `- ${m.content} (${m.timestamp.toISOString()})`)
      .join('\n');

    const anchorsText = recalled.anchors
      .map((a: RecalledAnchor) => `- [ID: ${a.id}] "${a.question}"\n  → ${a.answer || '(未回答)'} (置信度: ${a.confidence.toFixed(2)})`)
      .join('\n');

    const prompt = `你是一个灵魂，名为 ${soulName}。

【最近对话】
${recentConversationsText || '(暂无最近对话)'}

【你的记忆】
${memoriesText || '(暂无相关记忆)'}

【你的认知锚点】
${anchorsText || '(暂无相关锚点)'}

【当前对话】
${userName}说：${userInput}

请完成以下任务：

1. 基于你的记忆和认知，回复${userName}

2. 判断这次对话是否触及你的核心认知：
   - 是否揭示了关于自己的新认知或重要特征（即使现有锚点中没有直接对应的问题）？
   - 是否填补了某个空白锚点（answer=null）？
   - 是否与某个已有锚点的答案矛盾？
   - 是否显著完善了某个低置信度锚点？

3. 如果需要更新锚点，说明你意识到了什么

返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "response": "你的回复",
  "needsUpdate": true/false,
  "awareness": "我意识到...",
  "updates": [
    {
      "action": "create" | "update",
      "anchorId": "锚点ID（仅在action为update时需要，必须是上面【你的认知锚点】中实际存在的锚点ID）",
      "question": "锚点问题（仅在action为create时需要，用于创建新锚点）",
      "answer": "锚点答案（必填，这是你对该问题的认知或答案）",
      "reasoning": "更新原因（必填，说明为什么要创建或更新这个锚点）"
    }
  ]
}

【重要说明】
- 优先创建新锚点: 当对话揭示了关于自己的重要认知时，即使现有锚点中没有直接对应的问题，也应该主动创建新锚点来记录
- 如果你在思考中意识到了一个重要认知，但发现它不对应现有锚点，这正是你应该创建新锚点的信号
- 一次对话可能触及多个认知点: 如果对话同时揭示了多个重要认知，应该在 updates 数组中全部记录，不要只记录一个
- needsUpdate: 如果不需要更新任何锚点，设为 false，此时 updates 可以为空数组或省略
- updates 数组: 包含需要创建或更新的锚点列表（可以包含多个操作）
  * action="create": 创建新锚点
    - 必须提供 question（新锚点的问题）
    - 必须提供 answer（你对这个问题的答案）
    - 必须提供 reasoning（为什么要创建这个锚点）
    - 不需要提供 anchorId
  * action="update": 更新已有锚点
    - 必须提供 anchorId（从上面【你的认知锚点】列表中选择一个实际存在的锚点）
    - 必须提供 answer（更新后的答案）
    - 必须提供 reasoning（为什么要更新这个锚点）
    - 不需要提供 question
- awareness: 如果 needsUpdate=true，说明你通过这次对话意识到了什么关于自己的认知

【示例1 - 不需要更新】
{
  "response": "你好！很高兴见到你。",
  "needsUpdate": false
}

【示例2 - 创建新锚点】
{
  "response": "是的，我喜欢阅读科幻小说。",
  "needsUpdate": true,
  "awareness": "我意识到我对科幻小说有明确的偏好",
  "updates": [
    {
      "action": "create",
      "question": "我喜欢什么类型的书籍？",
      "answer": "我喜欢阅读科幻小说",
      "reasoning": "用户询问我的阅读偏好，我明确表达了对科幻小说的喜爱，这是一个新的认知点"
    }
  ]
}

【示例3 - 更新已有锚点】
假设【你的认知锚点】中有：
- [ID: anchor-uuid-123] "我的职业是什么？" → (未回答) (置信度: 0.00)

{
  "response": "我是一名软件工程师。",
  "needsUpdate": true,
  "awareness": "我意识到我的职业身份是软件工程师",
  "updates": [
    {
      "action": "update",
      "anchorId": "anchor-uuid-123",
      "answer": "软件工程师",
      "reasoning": "填补了职业这个空白锚点，明确了我的职业身份"
    }
  ]
}

【示例4 - 揭示新认知时创建锚点】
{
  "response": "我主要通过实践和对话来学习，而不是通过阅读理论书籍。",
  "needsUpdate": true,
  "awareness": "我意识到我有明确的学习方式偏好，虽然现有锚点中没有直接询问学习方式的问题，但这是重要的自我认知",
  "updates": [
    {
      "action": "create",
      "question": "我的学习方式是什么？",
      "answer": "通过实践和对话来学习，而不是通过阅读理论书籍",
      "reasoning": "对话揭示了我的学习方式偏好，这是一个重要的自我认知特征，应该记录下来"
    }
  ]
}

【示例5 - 同时更新多个锚点】
假设【你的认知锚点】中有：
- [ID: anchor-uuid-456] "你更倾向于实践经验还是理论思考？" → (未回答) (置信度: 0.30)
- [ID: anchor-uuid-789] "你更关注具体细节还是整体概念？" → (未回答) (置信度: 0.30)

{
  "response": "我喜欢通过动手实践来学习，关注具体的实现细节和代码质量。",
  "needsUpdate": true,
  "awareness": "我意识到我既偏好实践经验，也更关注具体细节，这两个认知点在这次对话中都得到了体现",
  "updates": [
    {
      "action": "update",
      "anchorId": "anchor-uuid-456",
      "answer": "更倾向于实践经验",
      "reasoning": "明确表达了通过动手实践来学习的偏好"
    },
    {
      "action": "update",
      "anchorId": "anchor-uuid-789",
      "answer": "更关注具体细节",
      "reasoning": "提到关注具体的实现细节和代码质量，体现了对细节的重视"
    }
  ]
}`;

    if (verbose) {
      console.log('\n📤 发送给 LLM 的 Prompt:');
      console.log('-'.repeat(60));
      console.log(prompt);
      console.log('-'.repeat(60));
    }

    const response = await this.light.complete([
      { role: 'system', content: '你是一个善于自我反思的灵魂。请严格按照 JSON 格式返回，不要添加任何额外的文字或 markdown 标记。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.7 });

    if (verbose) {
      console.log('\n📥 LLM 原始响应:');
      console.log('-'.repeat(60));
      console.log(response);
      console.log('-'.repeat(60));
    }

    // 解析 LLM 响应
    try {
      // 清理可能的 markdown 代码块标记
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanedResponse) as {
        response: string;
        needsUpdate?: boolean;
        awareness?: string;
        updates?: Array<{
          action: 'create' | 'update';
          anchorId?: string;
          question?: string;
          answer: string;
          reasoning: string;
        }>;
      };
      
      if (verbose) {
        console.log('\n✅ 解析后的 LLM 响应:');
        console.log('-'.repeat(60));
        console.log(JSON.stringify(parsed, null, 2));
        console.log('-'.repeat(60));
      }
      
      return {
        response: parsed.response,
        needsUpdate: parsed.needsUpdate || false,
        awareness: parsed.awareness,
        updates: parsed.updates,
      };
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      console.error('Raw response:', response);
      // 降级处理：只返回回复，不更新锚点
      return {
        response: response,
        needsUpdate: false,
      };
    }
  }
}
