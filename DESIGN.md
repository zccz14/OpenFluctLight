# OpenFluctLight 技术设计

## 架构概览

OpenFluctLight 采用三层架构：

**基础层：核心操作**
- Remember（记住）
- Recall（回想）
- UpdateAnchor（更新锚点）

**管理层：数据管理器**
- SoulManager（灵魂管理）
- MemoryManager（记忆管理）
- AnchorManager（锚点管理）
- RelationshipManager（关系管理）

**应用层：高级操作**
- Chat（对话）- 协调核心操作的上层封装

## 数据模型

### Soul（灵魂）
```
id: string (UUID)
name: string
createdAt: timestamp
metadata: JSON (可扩展字段)
```

### Memory（记忆）
```
id: string (UUID)
soulId: string (外键)
content: string (陈述句)
type: enum ('experience' | 'knowledge' | 'conversation' | 'relationship_note')
timestamp: timestamp
metadata: JSON
```

### Anchor（灵魂锚点）
```
id: string (UUID)
soulId: string (外键)
question: string
answer: string | null
source: enum ('predefined' | 'auto_discovered')
confidence: float (0-1)
lastUpdated: timestamp
relatedMemoryIds: string[] (JSON)
```

### Relationship（人际关系）
```
id: string (UUID)
soulId: string (外键，主体)
targetId: string (对象)
targetType: enum ('soul' | 'external')
lastInteraction: timestamp
metadata: JSON
```

## 核心操作设计

### Remember（记住）

**职责：** 将记忆写入存储，生成语义向量

**输入：**
- soulId: 灵魂 ID
- content: 记忆内容（陈述句）
- type: 记忆类型（可选）
- timestamp: 时间戳（可选，默认当前时间）

**计算过程：**
1. 本地写入：存储到 SQLite
2. Embedding 服务：调用 OpenAI 兼容接口生成向量
3. 本地写入：向量存储到 Vectra

**输出：** Memory 对象

**副作用：** 创建新记忆记录

---

### Recall（回想）

**职责：** 基于语义检索相关记忆和锚点

**输入：**
- soulId: 灵魂 ID
- prompt: 提问或场景描述
- contextId: 他者身份（可选）
- memoryLimit: 召回记忆数量上限（默认 20）

**计算过程：**
1. Embedding 服务：将 prompt 转换为向量
2. 本地计算：Vectra 向量检索，找到相似记忆
3. 本地读取：从 SQLite 查询完整记忆内容
4. Embedding 服务：将锚点问题转换为向量（批量）
5. 本地计算：计算余弦相似度，筛选相关锚点（top-k）
6. 本地读取：如果指定 contextId，查询关系相关的记忆和锚点

**输出：**
```
{
  memories: Memory[],
  anchors: Array<{question, answer, confidence}>,
  relationship?: {
    relatedMemories: Memory[],
    anchors: Array<{question, answer, confidence}>
  }
}
```

**副作用：** 无

---

### UpdateAnchor（更新锚点）

**职责：** 执行锚点的创建、更新、删除操作

**输入：**
```
soulId: string
action: 'create' | 'update' | 'delete'

// 根据 action 不同，附加参数不同：
// create: {question, answer, source, confidence, relatedMemoryIds}
// update: {anchorId, answer, confidence, relatedMemoryIds}
// delete: {anchorId}
```

**计算过程：**
- 纯本地数据库操作（SQLite）
- 不调用任何外部服务

**输出：** Anchor 对象（delete 操作无返回）

**副作用：** 修改锚点记录

## 预设锚点机制

### 初始化时机
灵魂创建时（SoulManager.create），自动初始化 20-30 个预设锚点。

### 预设锚点来源
- **MBTI 维度**：8 个问题，覆盖 E/I, S/N, T/F, J/P
- **施瓦茨价值观**：10 个问题，覆盖核心价值维度
- **通用认知**：10 个问题，覆盖决策、冲突、风险等

### 预设锚点特征
- source = 'predefined'
- answer = null（等待记忆填充）
- confidence = 0.3（初始低置信度）

### 示例问题
- "面对重要决策时，你更依赖直觉还是理性分析？"
- "你更看重个人成就还是集体和谐？"
- "面对冲突时，你倾向于直接表达还是回避？"

## Chat 高级操作设计

### 职责
协调核心操作，实现完整的对话交互流程，包含智能判断和锚点更新。

### 流程设计

**1. Remember 阶段（用户输入）**
```
userMemory = Remember(soulId, `用户 ${userName} 说：${userInput}`, {
  type: 'conversation',
  metadata: { speaker: userName, role: 'user' }
})
```
记录：用户 X 在何时说了什么话。

**2. Recall 阶段**
```
recalled = Recall(soulId, userInput, contextId)
// 返回：memories, anchors, relationship
```
召回相关记忆和认知，为生成回复提供依据。

**3. LLM 判断阶段**
```
输入给 LLM：
- userInput
- recalled.memories
- recalled.anchors
- recalled.relationship

任务：
1. 生成回复
2. 判断是否需要更新锚点
3. 如果需要更新，说明意识到了什么

输出：
{
  response: string,
  needsUpdate: boolean,
  awareness?: string,  // 我意识到了什么
  updates?: Array<{
    action: 'create' | 'update',
    anchorId?: string,
    question?: string,
    answer: string,
    reasoning: string
  }>
}
```

**4. Remember 阶段（AI 回复）**
```
aiMemory = Remember(soulId, `我回复 ${userName}：${response}`, {
  type: 'conversation',
  metadata: { speaker: 'self', role: 'assistant', targetUser: userName }
})
```
记录：我（灵魂）在何时回复了 X，回复了什么内容。

**5. UpdateAnchor 阶段（条件性）**
```
if (needsUpdate) {
  for (update of updates) {
    UpdateAnchor(soulId, update)
  }
}
```

**6. Remember 阶段（认知更新）**
```
if (needsUpdate && awareness) {
  awarenessMemory = Remember(soulId, awareness, {
    type: 'experience',
    metadata: { category: 'self-awareness' }
  })
}
```
记录：我意识到了什么。例如："我意识到自己在不同情境下对风险的态度是不同的"。

**7. 返回**
```
return {
  response: string,
  updatedAnchors?: Anchor[]
}
```

### Remember 的三次调用

Chat 操作中，Remember 被调用最多三次，每次记录不同类型的内容：

**第一次：用户输入**
- 内容：`用户 X 说：[用户的话]`
- 类型：conversation
- 意义：记录外界的输入，他者的观点

**第二次：AI 回复**
- 内容：`我回复 X：[我的回复]`
- 类型：conversation
- 意义：记录自己的输出，自己的表达

**第三次：认知更新（可选）**
- 内容：`我意识到 [某个认知]`
- 类型：experience
- 意义：记录元认知，自我反思的结果

这三类记忆共同构成了完整的对话经历：
- 他者说了什么
- 我说了什么
- 我从中领悟了什么

这些记忆都会成为后续 Recall 和求索的素材，让灵魂能够回顾自己的成长轨迹。

### 增量求索策略

**核心思想：** 避免全量扫描，只处理新记忆

**判断逻辑（在 LLM 中）：**
- 新记忆与哪些锚点高度相关？（基于 Recall 结果）
- 对每个相关锚点：
  - 如果 answer = null → 生成初始答案
  - 如果 answer 存在且一致 → 可选择性完善（提升 confidence）
  - 如果 answer 存在但矛盾 → 辩证处理，可能创建新锚点

**成本优化：**
- 成熟灵魂的大部分对话返回 needsUpdate = false
- 只有真正触及核心认知的对话才会更新锚点
- LLM 判断与回复生成在同一次调用中完成，零额外成本

### 辩证法处理

当发现矛盾时，LLM 的任务：
1. 承认两种情况都存在
2. 说明它们在不同情境下的合理性
3. 形成更深层的统一认知

示例：
```
旧答案："我倾向于规避风险"
新记忆："我今天做了一个大胆的投资决定"

辩证答案："我在日常决策中倾向于规避风险，但在充分研究和准备后，
我愿意为重要机会承担计算过的风险"

可能生成新锚点："在什么情况下你愿意承担风险？"
```

## 服务依赖

### Embedding 服务
- **用途**：文本向量化
- **调用位置**：Remember, Recall
- **模型**：text-embedding-3-small（OpenAI 兼容）
- **成本**：按 token 计费

### LLM 服务
- **用途**：生成回复、判断锚点更新、辩证处理
- **调用位置**：Chat
- **模型**：gpt-4o-mini 或兼容模型
- **成本**：按 token 计费

### 本地计算
- **SQLite**：结构化数据存储和查询
- **Vectra**：向量存储和相似度检索
- **余弦相似度**：锚点相关性计算

## 性能考虑

### 向量检索优化
- Vectra 支持高效的 ANN（近似最近邻）检索
- 记忆数量增长不会显著影响检索性能

### LLM 调用优化
- Chat 中的判断与回复生成合并为一次调用
- 成熟灵魂的大部分对话不触发锚点更新
- 批量处理锚点相关性判断（在 Recall 中）

### 数据库优化
- 为常用查询字段建立索引（soulId, timestamp）
- 使用 JSON 字段存储灵活的 metadata

## 扩展性设计

### 多模态记忆
当前只支持文本，未来可扩展：
- 图像记忆（存储图像向量）
- 音频记忆（存储音频特征）

### 自定义锚点框架
允许用户定义自己的认知框架，替代或补充预设锚点。

### 分布式部署
当前为单机版，未来可支持：
- 云端同步
- 多设备共享灵魂

### 遗忘机制
低优先级功能，未来可实现：
- 基于时间衰减的遗忘
- 基于访问频率的遗忘
- 用户手动标记的遗忘

## 安全性考虑

### 数据隐私
- 本地优先：数据存储在用户本地
- 可选加密：SQLite 支持加密扩展

### API Key 管理
- 支持环境变量配置
- 支持自定义 OpenAI 兼容端点

### 输入验证
- 记忆内容长度限制
- SQL 注入防护（使用参数化查询）
- 向量维度验证
