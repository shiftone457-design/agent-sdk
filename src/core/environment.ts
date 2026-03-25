import { execSync } from 'child_process';

export interface EnvironmentInfo {
  cwd: string;
  platform: NodeJS.Platform;
  date: string;
  isGitRepo: boolean;
  shell: string | undefined;
}

export function getEnvironmentInfo(cwd: string): EnvironmentInfo {
  let isGitRepo = false;
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' });
    isGitRepo = true;
  } catch { /* not a git repo */ }

  // 检测 Shell
  let shell: string | undefined;
  if (process.platform === 'win32') {
    // Windows: 检查 ComSpec (cmd.exe 或 powershell.exe)
    const comSpec = process.env.ComSpec;
    if (comSpec) {
      const comSpecName = comSpec.split('\\').pop()?.replace(/\.exe$/i, '');
      shell = comSpecName === 'cmd' ? 'cmd' : comSpecName;
    }
    // 默认
    if (!shell) {
      shell = 'powershell';
    }
  } else {
    // Unix: 使用 SHELL 环境变量
    shell = process.env.SHELL?.split('/').pop();
  }

  return {
    cwd,
    platform: process.platform,
    date: new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }),
    isGitRepo,
    shell
  };
}

export function formatEnvironmentSection(info: EnvironmentInfo): string {
  const shellLine = info.shell ? `\n  Shell: ${info.shell}` : '';
  return `
## Environment

<env>
  Working directory: ${info.cwd}
  Platform: ${info.platform}
  Today's date: ${info.date}
  Is git repo: ${info.isGitRepo ? 'yes' : 'no'}${shellLine}
</env>`;
}