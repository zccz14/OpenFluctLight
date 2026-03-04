#!/usr/bin/env node

import { Cli } from 'clipanion';
import { ChatCommand } from './commands/ChatCommand';
import { InitCommand } from './commands/InitCommand';

const cli = new Cli({
  binaryLabel: 'OpenFluctLight CLI',
  binaryName: 'ofl',
  binaryVersion: '0.1.0',
});

cli.register(InitCommand);
cli.register(ChatCommand);

cli.runExit(process.argv.slice(2));
