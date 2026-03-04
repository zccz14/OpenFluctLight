import { Command, Option } from 'clipanion';
import { OpenFluctLight } from '@openfluctlight/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { displayWelcome, displayRecalled, displayAnchorUpdates, displaySeparator } from '../utils/display.js';

export class ChatCommand extends Command {
  static paths = [['chat']];

  static usage = Command.Usage({
    description: '与灵魂对话',
    examples: [
      ['与名为 Alice 的灵魂对话', 'ofl chat -s Alice'],
    ],
  });

  soul = Option.String('-s,--soul', {
    description: '灵魂名称',
    required: true,
  });

  user = Option.String('-u,--user', {
    description: '用户名称',
    required: false,
  });

  async execute() {
    const configPath = path.join(os.homedir(), '.openfluctlight', 'config.json');
    
    // 检查配置文件
    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('错误: 未找到配置文件'));
      console.log(chalk.yellow('请先运行: ofl init'));
      return 1;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dataPath = path.join(config.dataPath, this.soul!);

    // 初始化 OpenFluctLight
    const light = new OpenFluctLight({
      dataPath,
      llmApiKey: config.llmApiKey,
      llmBaseURL: config.llmBaseURL,
      llmModel: config.llmModel,
      useLocalEmbedding: config.useLocalEmbedding || false,
      embeddingApiKey: config.embeddingApiKey,
      embeddingBaseURL: config.embeddingBaseURL,
      embeddingModel: config.embeddingModel,
    });

    await light.initialize();

    // 检查或创建灵魂
    let souls = await light.souls.list();
    let soul = souls.find(s => s.name === this.soul);

    if (!soul) {
      console.log(chalk.yellow(`灵魂 "${this.soul}" 不存在，正在创建...`));
      soul = await light.souls.create(this.soul!);
      console.log(chalk.green(`✓ 灵魂 "${this.soul}" 已创建，包含 28 个预设锚点`));
      console.log();
    }

    const userName = this.user || '你';
    displayWelcome(soul.name, dataPath);

    // 交互式对话循环
    while (true) {
      const { userInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userInput',
          message: chalk.blue(`${userName}:`),
        },
      ]);

      if (!userInput || userInput.trim() === '') {
        continue;
      }

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        console.log(chalk.cyan('\n再见！'));
        await light.close();
        break;
      }

      try {
        // 调用 Chat
        const result = await light.chat.chat(soul.id, userInput, {
          userName,
        });

        // 显示召回的记忆和锚点
        displayRecalled(result.recalled.memories, result.recalled.anchors);

        // 显示 AI 回复
        console.log(chalk.green(`\n${soul.name}: ${result.response}`));

        // 显示锚点更新
        if (result.updatedAnchors) {
          displayAnchorUpdates(result.updatedAnchors);
        }

        displaySeparator();
      } catch (error: any) {
        console.error(chalk.red(`\n错误: ${error.message}`));
        console.error(chalk.gray(error.stack));
        displaySeparator();
      }
    }

    return 0;
  }
}
