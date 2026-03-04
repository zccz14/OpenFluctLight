import { OpenFluctLight } from './core';
import { Anchor, Memory } from './types';

export interface ChatOptions {
  contextId?: string;  // 对话对象的身份
  userName?: string;   // 用户名称
}

export interface ChatResult {
  response: string;
  updatedAnchors?: Anchor[];
  recalled: {
    memories: Memory[];
    anchors: Array<{question: string; answer: string | null; confidence: number}>;
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

    // 1. Remember 用户输入
    await this.light.memories.remember(soulId, `${userName}说：${userInput}`, {
      type: 'conversation',
      metadata: { speaker: userName, role: 'user' }
    });

    // 2. Recall 召回认知
    const recalled = await this.light.recall.recall(soulId, userInput, contextId);

    // 3. LLM 判断
    const llmResult = await this.generateLLMResponse(
      soulId,
      userInput,
      userName,
      recalled
    );

    // 4. Remember AI 回复
    await this.light.memories.remember(soulId, `我回复${userName}：${llmResult.response}`, {
      type: 'conversation',
      metadata: { speaker: 'self', role: 'assistant', targetUser: userName }
    });

    // 5. UpdateAnchor（条件性）
    const updatedAnchors: Anchor[] = [];
    if (llmResult.needsUpdate && llmResult.updates) {
      for (const update of llmResult.updates) {
        let result: Anchor | void = undefined;
        
        if (update.action === 'create') {
          result = await this.light.anchors.updateAnchor(soulId, {
            action: 'create',
            question: update.question!,
            answer: update.answer,
            source: 'auto_discovered',
          });
        } else if (update.action === 'update') {
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
      await this.light.memories.remember(soulId, llmResult.awareness, {
        type: 'experience',
        metadata: { category: 'self-awareness' }
      });
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
    recalled: any
  ): Promise<LLMResponse> {
    // 获取灵魂信息
    const soul = await this.light.souls.get(soulId);
    const soulName = soul?.name || '灵魂';

    // 构建 prompt
    const memoriesText = recalled.memories
      .map((m: Memory) => `- ${m.content} (${m.timestamp.toISOString().split('T')[0]})`)
      .join('\n');

    const anchorsText = recalled.anchors
      .map((a: any) => `- "${a.question}"\n  → ${a.answer || '(未回答)'} (置信度: ${a.confidence.toFixed(2)})`)
      .join('\n');

    const prompt = `你是一个灵魂，名为 ${soulName}。

【你的记忆】
${memoriesText || '(暂无相关记忆)'}

【你的认知锚点】
${anchorsText || '(暂无相关锚点)'}

【当前对话】
${userName}说：${userInput}

请完成以下任务：

1. 基于你的记忆和认知，回复${userName}

2. 判断这次对话是否触及你的核心认知：
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
      "anchorId": "...",
      "question": "...",
      "answer": "...",
      "reasoning": "..."
    }
  ]
}`;

    const response = await this.light.complete([
      { role: 'system', content: '你是一个善于自我反思的灵魂。请严格按照 JSON 格式返回，不要添加任何额外的文字或 markdown 标记。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.7 });

    // 解析 LLM 响应
    try {
      // 清理可能的 markdown 代码块标记
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanedResponse);
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
