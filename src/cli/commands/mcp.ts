import { Command } from 'commander';
import chalk from 'chalk';
import { MCPAdapter } from '../../mcp/adapter.js';
import { MCPServers } from '../../mcp/transport.js';
import { formatTable } from '../utils/output.js';

/**
 * MCP 管理命令
 */
export function createMCPCommand(): Command {
  const command = new Command('mcp')
    .description('Manage MCP servers');

  // 连接 MCP 服务器
  command
    .command('connect <command>')
    .description('Connect to an MCP server')
    .option('-n, --name <name>', 'Server name', 'default')
    .option('-a, --args <args>', 'Command arguments (comma-separated)')
    .option('-e, --env <env>', 'Environment variables (KEY=VALUE,comma-separated)')
    .action(async (cmd, options) => {
      try {
        const adapter = new MCPAdapter();

        const args = options.args ? options.args.split(',') : [];
        const env: Record<string, string> = {};
        if (options.env) {
          for (const pair of options.env.split(',')) {
            const [key, value] = pair.split('=');
            if (key && value) {
              env[key] = value;
            }
          }
        }

        console.log(chalk.cyan(`\n🔌 Connecting to MCP server: ${options.name}\n`));

        await adapter.addServer({
          name: options.name,
          transport: 'stdio',
          command: cmd,
          args,
          env: Object.keys(env).length > 0 ? env : undefined
        });

        console.log(chalk.green('✓ Connected successfully'));

        // 列出可用工具
        const tools = await adapter.listAllTools();
        const serverTools = tools.get(options.name) || [];

        if (serverTools.length > 0) {
          console.log(chalk.cyan('\n📦 Available tools:\n'));
          for (const tool of serverTools) {
            console.log(`  • ${tool.name}: ${tool.description || 'No description'}`);
          }
        }

        await adapter.disconnectAll();
      } catch (err) {
        console.error(chalk.red(`Connection failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  // 列出常用 MCP 服务器
  command
    .command('presets')
    .description('List available MCP server presets')
    .action(() => {
      console.log(chalk.cyan('\n🔌 Available MCP Server Presets\n'));

      const presets = Object.entries(MCPServers).map(([name, factory]) => {
        const config = (factory as (arg: any) => any)([]);
        return {
          name,
          command: config.command,
          args: config.args?.slice(0, 3).join(' ') + (config.args && config.args.length > 3 ? '...' : '')
        };
      });

      console.log(formatTable(
        presets,
        [
          { key: 'name', header: 'Name', width: 20 },
          { key: 'command', header: 'Command', width: 15 },
          { key: 'args', header: 'Arguments', width: 40 }
        ]
      ));

      console.log(chalk.gray('\nUse: agent-sdk mcp use <preset> [options]'));
    });

  // 使用预设服务器
  command
    .command('use <preset>')
    .description('Connect to a preset MCP server')
    .option('-p, --param <param>', 'Additional parameter')
    .action(async (preset, options) => {
      try {
        const factory = (MCPServers as any)[preset];
        if (!factory) {
          console.error(chalk.red(`Unknown preset: ${preset}`));
          console.log(chalk.gray('Available presets: ' + Object.keys(MCPServers).join(', ')));
          process.exit(1);
        }

        const adapter = new MCPAdapter();
        const config = options.param ? factory(options.param) : factory([]);

        console.log(chalk.cyan(`\n🔌 Connecting to ${preset} server...\n`));

        await adapter.addServer(config);

        console.log(chalk.green('✓ Connected successfully'));

        const tools = await adapter.listAllTools();
        const serverTools = tools.get(config.name) || [];

        if (serverTools.length > 0) {
          console.log(chalk.cyan('\n📦 Available tools:\n'));
          for (const tool of serverTools) {
            console.log(`  • ${tool.name}: ${tool.description || 'No description'}`);
          }
        }

        await adapter.disconnectAll();
      } catch (err) {
        console.error(chalk.red(`Connection failed: ${err instanceof Error ? err.message : err}`));
        process.exit(1);
      }
    });

  return command;
}
