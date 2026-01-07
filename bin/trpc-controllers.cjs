#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function printHelp() {
  console.log(`trpc-controllers

Usage:
  trpc-controllers types --project <path> [--cwd <path>] [--no-alias]

Options:
  --project, -p   Path to a tsconfig.json that emits declarations
  --cwd           Working directory for running tsc/tsc-alias
  --no-alias      Skip running tsc-alias (if installed)
`);
}

function getArg(args, name, alias) {
  const idx = args.indexOf(name);
  if (idx !== -1) return args[idx + 1];
  if (alias) {
    const aliasIdx = args.indexOf(alias);
    if (aliasIdx !== -1) return args[aliasIdx + 1];
  }
  return undefined;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function resolveBin(binName, startDir) {
  const exe = process.platform === 'win32' ? `${binName}.cmd` : binName;
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', '.bin', exe);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function runBin(binName, args, cwd, options = {}) {
  const optional = options.optional === true;
  const isPath = binName.includes(path.sep);
  const resolved = isPath ? binName : resolveBin(binName, cwd);
  if (!resolved && optional) return false;
  const bin = resolved || binName;
  const result = spawnSync(bin, args, { stdio: 'inherit', cwd });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return true;
}

const args = process.argv.slice(2);
const command = args.shift();

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(command ? 0 : 1);
}

if (command === 'types') {
  const cwd = getArg(args, '--cwd') || process.cwd();
  const project = getArg(args, '--project', '-p');
  if (!project) {
    console.error('Missing --project <path>');
    printHelp();
    process.exit(1);
  }
  const projectPath = path.isAbsolute(project) ? project : path.join(cwd, project);
  if (!fs.existsSync(projectPath)) {
    console.error(`tsconfig not found: ${projectPath}`);
    process.exit(1);
  }
  runBin('tsc', ['-p', projectPath], cwd);
  if (!hasFlag(args, '--no-alias')) {
    runBin('tsc-alias', ['-p', projectPath], cwd, { optional: true });
  }
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
