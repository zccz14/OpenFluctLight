import { OpenFluctLight } from '@openfluctlight/core';

async function main() {
  // 初始化 OpenFluctLight
  const light = new OpenFluctLight({
    dataPath: './data',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseURL: process.env.OPENAI_BASE_URL,
  });

  await light.initialize();

  // 创建灵魂
  const soul = await light.souls.create('Alice');
  console.log('创建灵魂:', soul);

  // 记住
  await light.memories.remember(soul.id, '我今天学会了 TypeScript 的泛型');
  await light.memories.remember(soul.id, '我喜欢独自思考问题');
  await light.memories.remember(soul.id, '团队协作让我感到充实');
  console.log('已添加 3 条记忆');

  // 记忆求索
  console.log('\n执行记忆求索...');
  const seekResult = await light.questionSeek.seek(soul.id);
  console.log('发现矛盾:', seekResult.contradictions.length);
  console.log('新增锚点:', seekResult.newAnchors.length);

  // 提问推理
  console.log('\n执行提问推理...');
  const queryResult = await light.queryInference.query(
    soul.id,
    '我应该如何平衡独立工作和团队协作？'
  );
  console.log('召回记忆:', queryResult.memories.length);
  console.log('相关锚点:', queryResult.anchors.length);

  await light.close();
}

main().catch(console.error);
