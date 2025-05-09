#!/usr/bin/env node

import yargs from 'yargs/yargs';
import mockCommand from './commands/mock';
import proxyCommand from './commands/proxy';

yargs(process.argv.slice(2))
  .scriptName('prism')
  .version()
  .help(true)
  .strict()
  .command(mockCommand)
  .command(proxyCommand)
  .demandCommand(1, '').argv;
