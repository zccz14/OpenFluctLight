import { Command, Option } from 'clipanion';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface InitAnswers {
  dataPath: string;
  embeddingType: 'local' | 'openai';
  embeddingApiKey?: string;
  embeddingBaseURL?: string;
  embeddingModel?: string;
  llmApiKey: string;
  llmBaseURL: string;
  llmModel: string;
}

interface ConfigFile {
  dataPath: string;
  useLocalEmbedding: boolean;
  llmApiKey: string;
  llmBaseURL: string;
  llmModel: string;
  embeddingApiKey?: string;
  embeddingBaseURL?: string;
  embeddingModel?: string;
}

export class InitCommand extends Command {
  static paths = [['init']];

  static usage = Command.Usage({
    description: '初始化 OpenFluctLight 配置',
  });

  async execute() {
    console.log(chalk.cyan('欢迎使用 OpenFluctLight CLI！\n'));

    const answers = await inquirer.prompt<InitAnswers>([
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
          { name: '本地模型（无需 API，首次下载约 300MB）', value: 'local' },
          { name: 'OpenAI API（需要 API Key）', value: 'openai' },
        ],
        default: 'local',
      },
      {
        type: 'input',
        name: 'embeddingApiKey',
        message: 'Embedding API Key:',
        default: process.env.OPENAI_API_KEY || '',
        when: (answers: Partial<InitAnswers>) =>
          answers.embeddingType === 'openai',
      },
      {
        type: 'input',
        name: 'embeddingBaseURL',
        message: 'Embedding Base URL:',
        default: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        when: (answers: Partial<InitAnswers>) =>
          answers.embeddingType === 'openai',
      },
      {
        type: 'input',
        name: 'embeddingModel',
        message: 'Embedding 模型:',
        default: 'text-embedding-3-small',
        when: (answers: Partial<InitAnswers>) =>
          answers.embeddingType === 'openai',
      },
      {
        type: 'input',
        name: 'llmApiKey',
        message: 'LLM API Key:',
        default: process.env.OPENAI_API_KEY || '',
      },
      {
        type: 'input',
        name: 'llmBaseURL',
        message: 'LLM Base URL:',
        default: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
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
    const config: ConfigFile = {
      dataPath: answers.dataPath,
      useLocalEmbedding: answers.embeddingType === 'local',
      llmApiKey: answers.llmApiKey,
      llmBaseURL: answers.llmBaseURL,
      llmModel: answers.llmModel,
    };

    if (answers.embeddingType === 'openai') {
      config.embeddingApiKey = answers.embeddingApiKey;
      config.embeddingBaseURL = answers.embeddingBaseURL;
      config.embeddingModel = answers.embeddingModel;
    }

    // 写入配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✓ 配置已保存到: ${configPath}`));
    console.log(chalk.green(`✓ 数据目录: ${answers.dataPath}`));
    console.log(
      chalk.green(`✓ LLM: ${answers.llmModel} (${answers.llmBaseURL})`)
    );
    if (answers.embeddingType === 'local') {
      console.log(
        chalk.yellow('✓ Embedding: 本地模型（首次使用时会自动下载约 300MB）')
      );
    } else {
      console.log(
        chalk.green(
          `✓ Embedding: ${answers.embeddingModel} (${answers.embeddingBaseURL})`
        )
      );
    }
    console.log(chalk.cyan('\n现在可以使用: ofl chat -s <灵魂名称>'));

    return 0;
  }
}
