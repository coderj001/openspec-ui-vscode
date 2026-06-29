import { runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void main();
