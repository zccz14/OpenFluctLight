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
        type: 'list',
        name: 'embeddingType',
        message: 'Embedding 服务类型:',
        choices: [
          { name: '本地模型（无需 API，首次下载约 23MB）', value: 'local' },
          { name: 'OpenAI API（需要 API Key）', value: 'openai' },
        ],
        default: 'local',
      },
      {
        type: 'input',
        name: 'openaiApiKey',
        message: 'OpenAI API Key:',
        default: process.env.OPENAI_API_KEY || '',
        when: (answers: any) => answers.embeddingType === 'openai',
      },
      {
        type: 'input',
        name: 'openaiBaseURL',
        message: 'OpenAI Base URL:',
        default: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        when: (answers: any) => answers.embeddingType === 'openai',
      },
      {
        type: 'input',
        name: 'embeddingModel',
        message: 'Embedding 模型:',
        default: 'text-embedding-3-small',
        when: (answers: any) => answers.embeddingType === 'openai',
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

    // 构建配置对象
    const config: any = {
      dataPath: answers.dataPath,
      llmModel: answers.llmModel,
      useLocalEmbedding: answers.embeddingType === 'local',
    };

    if (answers.embeddingType === 'openai') {
      config.openaiApiKey = answers.openaiApiKey;
      config.openaiBaseURL = answers.openaiBaseURL;
      config.embeddingModel = answers.embeddingModel;
    }

    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✓ 配置已保存到: ${configPath}`));
    console.log(chalk.green(`✓ 数据目录: ${answers.dataPath}`));
    if (answers.embeddingType === 'local') {
      console.log(chalk.yellow('✓ 使用本地 Embedding 模型（首次使用时会自动下载）'));
    }
    console.log(chalk.cyan('\n现在可以使用: ofl chat -s <灵魂名称>'));

    return 0;
  }
}
