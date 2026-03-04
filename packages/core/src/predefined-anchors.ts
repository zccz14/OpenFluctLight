/**
 * 预设灵魂锚点
 * 基于 MBTI、施瓦茨价值观和通用认知框架
 */

export interface PredefinedAnchor {
  category: string;
  question: string;
  framework: string;
}

export const PREDEFINED_ANCHORS: PredefinedAnchor[] = [
  // MBTI 维度（8个）
  {
    category: 'personality',
    question: '在社交场合中，你是主动交流还是倾向观察？',
    framework: 'MBTI-E/I'
  },
  {
    category: 'personality',
    question: '你更关注具体细节还是整体概念？',
    framework: 'MBTI-S/N'
  },
  {
    category: 'personality',
    question: '面对重要决策时，你更依赖直觉还是理性分析？',
    framework: 'MBTI-T/F'
  },
  {
    category: 'personality',
    question: '你更喜欢有明确计划还是保持灵活性？',
    framework: 'MBTI-J/P'
  },
  {
    category: 'personality',
    question: '你从独处中获得能量还是从社交中获得能量？',
    framework: 'MBTI-E/I'
  },
  {
    category: 'personality',
    question: '你更倾向于实践经验还是理论思考？',
    framework: 'MBTI-S/N'
  },
  {
    category: 'personality',
    question: '在做决定时，你更看重逻辑还是人情？',
    framework: 'MBTI-T/F'
  },
  {
    category: 'personality',
    question: '你喜欢事情按计划进行还是随机应变？',
    framework: 'MBTI-J/P'
  },
  
  // 施瓦茨价值观（10个）
  {
    category: 'values',
    question: '你更看重个人成就还是集体和谐？',
    framework: 'Schwartz-Achievement/Benevolence'
  },
  {
    category: 'values',
    question: '你如何看待传统和创新？',
    framework: 'Schwartz-Tradition/Stimulation'
  },
  {
    category: 'values',
    question: '你更追求安全稳定还是冒险探索？',
    framework: 'Schwartz-Security/Stimulation'
  },
  {
    category: 'values',
    question: '你更重视权力影响力还是平等公正？',
    framework: 'Schwartz-Power/Universalism'
  },
  {
    category: 'values',
    question: '你更看重享乐快感还是自律克制？',
    framework: 'Schwartz-Hedonism/Conformity'
  },
  {
    category: 'values',
    question: '你更倾向于独立自主还是遵从规范？',
    framework: 'Schwartz-Self-Direction/Conformity'
  },
  {
    category: 'values',
    question: '你更关注个人利益还是他人福祉？',
    framework: 'Schwartz-Achievement/Benevolence'
  },
  {
    category: 'values',
    question: '你更追求新奇刺激还是熟悉舒适？',
    framework: 'Schwartz-Stimulation/Security'
  },
  {
    category: 'values',
    question: '你更看重物质成功还是精神满足？',
    framework: 'Schwartz-Achievement/Universalism'
  },
  {
    category: 'values',
    question: '你更倾向于竞争还是合作？',
    framework: 'Schwartz-Power/Benevolence'
  },
  
  // 通用认知（10个）
  {
    category: 'cognition',
    question: '面对冲突时，你倾向于直接表达还是回避？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你如何看待失败和挫折？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你更重视过程还是结果？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你如何看待风险和不确定性？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你更倾向于快速决策还是深思熟虑？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你如何平衡工作和生活？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你更看重短期收益还是长期价值？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你如何处理压力和焦虑？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你更倾向于坚持己见还是接纳他人意见？',
    framework: 'General'
  },
  {
    category: 'cognition',
    question: '你如何定义成功？',
    framework: 'General'
  }
];
