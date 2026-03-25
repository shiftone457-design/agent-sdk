import { existsSync } from 'fs';
import { execSync } from 'child_process';

export interface EnvironmentInfo {
  cwd: string;
  platform: NodeJS.Platform;
  date: string;
  isGitRepo: boolean;
  shell: string | undefined;
}

export function getShellPath(): string {
  if (process.platform === 'win32') {
    const gitBashPaths = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ];
    for (const path of gitBashPaths) {
      if (existsSync(path)) return path;
    }
    try {
      const bashPath = execSync('where bash', { encoding: 'utf-8' }).trim().split('\n')[0];
      if (bashPath && existsSync(bashPath)) return bashPath;
    } catch { /* not found */ }

    try {
      execSync('where pwsh', { encoding: 'utf-8' });
      return 'pwsh';
    } catch { /* not found */ }

    return 'powershell.exe';
  }

  return process.env.SHELL || '/bin/bash';
}

export function getEnvironmentInfo(cwd: string): EnvironmentInfo {
  let isGitRepo = false;
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'pipe' });
    isGitRepo = true;
  } catch { /* not a git repo */ }

  const shellPath = getShellPath();
  const shell = shellPath.split(/[/\\]/).pop()?.replace(/\.exe$/i, '');

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