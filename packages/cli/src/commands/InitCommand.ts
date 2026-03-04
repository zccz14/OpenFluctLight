import { Command, Option } from 'clipanion';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class InitCommand extends Command {
  static paths = [['init']];

  static usage = Command.Usage({
    description: '初始化 OpenFluctLight 配置',
  });

  async execute() {
    console.log(chalk.cyan('欢迎使用 OpenFluctLight CLI！\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'dataPath',
        message: '数据存储路径:',
        default: path.join(os.homedir(), '.openfluctlight', 'data'),
      },
      {
        type: 'input',
        name: 'openaiApiKey',
        message: 'OpenAI API Key:',
        default: process.env.OPENAI_API_KEY || '',
      },
      {
        type: 'input',
        name: 'openaiBaseURL',
        message: 'OpenAI Base URL:',
        default: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      },
      {
        type: 'input',
        name: 'embeddingModel',
        message: 'Embedding 模型:',
        default: 'text-embedding-3-small',
      },
      {
        type: 'input',
        name: 'llmModel',
        message: 'LLM 模型:',
        default: 'gpt-4o-mini',
      },
    ]);

    const configDir = path.join(os.homedir(), '.openfluctlight');
    const configPath = path.join(configDir, 'config.json');

    // 创建配置目录
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 创建数据目录
    if (!fs.existsSync(answers.dataPath)) {
      fs.mkdirSync(answers.dataPath, { recursive: true });
    }

    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(answers, null, 2));

    console.log(chalk.green(`\n✓ 配置已保存到: ${configPath}`));
    console.log(chalk.green(`✓ 数据目录: ${answers.dataPath}`));
    console.log(chalk.cyan('\n现在可以使用: ofl chat -s <灵魂名称>'));

    return 0;
  }
}
