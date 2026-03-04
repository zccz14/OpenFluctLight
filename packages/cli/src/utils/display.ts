import chalk from 'chalk';
import type { Memory, Anchor } from '@openfluctlight/core';

export function displayWelcome(soulName: string, dataPath: string) {
  console.log(chalk.cyan('╭─────────────────────────────────────────╮'));
  console.log(chalk.cyan(`│ 与灵魂 ${chalk.bold(soulName)} 对话`));
  console.log(chalk.cyan(`│ 数据路径: ${dataPath}`));
  console.log(chalk.cyan('╰─────────────────────────────────────────╯'));
  console.log();
}

interface RecalledAnchor {
  question: string;
  answer: string | null;
  confidence: number;
}

export function displayRecalled(memories: Memory[], anchors: RecalledAnchor[]) {
  if (memories.length > 0) {
    console.log(chalk.yellow(`\n[召回记忆 ${memories.length} 条]`));
    memories.slice(0, 3).forEach(m => {
      const timestamp = new Date(m.timestamp).toISOString();
      console.log(chalk.gray(`• ${m.content.substring(0, 60)}... (${timestamp})`));
    });
  }

  if (anchors.length > 0) {
    console.log(chalk.yellow(`\n[相关锚点 ${anchors.length} 个]`));
    anchors.slice(0, 2).forEach(a => {
      console.log(chalk.gray(`• ${a.question}`));
      if (a.answer) {
        console.log(chalk.gray(`  → "${a.answer.substring(0, 50)}..." (置信度: ${a.confidence.toFixed(2)})`));
      } else {
        console.log(chalk.gray(`  → (未回答)`));
      }
    });
  }
}

export function displayAnchorUpdates(anchors: Anchor[]) {
  if (anchors.length > 0) {
    console.log(chalk.green(`\n[锚点更新]`));
    anchors.forEach(a => {
      console.log(chalk.green(`✓ ${a.source === 'predefined' ? '更新' : '新增'}锚点: "${a.question}"`));
      if (a.answer) {
        console.log(chalk.gray(`  新答案: "${a.answer.substring(0, 80)}..."`));
      }
    });
  }
}

export function displaySeparator() {
  console.log(chalk.gray('\n───────────────────────────────────────────\n'));
}
