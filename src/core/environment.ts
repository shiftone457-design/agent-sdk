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

  const shell = process.env.SHELL 
    || (process.platform === 'win32' ? 'powershell' : undefined);

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