import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../../dist/server.js');

describe('MCP Server Health Tool Integration Test', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Create transport with command configuration - SDK spawns the process
    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });
    
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
  }, 10000); // 10 second timeout for server start

  afterAll(async () => {
    await client.close();
  });

  it('should list the system/health tool', async () => {
    const response = await client.listTools();
    expect(response.tools).toBeInstanceOf(Array);
    const healthTool = response.tools.find(t => t.name === 'system/health');
    expect(healthTool).toBeDefined();
    expect(healthTool?.description).toContain('health status');
  });

  it('should successfully call the system/health tool', async () => {
    const response: any = await client.callTool({
      name: 'system/health',
      arguments: {}
    });
    
    expect(response).toBeDefined();
    expect(response.status).toBe('healthy');
    expect(typeof response.uptime).toBe('number');
    expect(response.uptime).toBeGreaterThan(0);
    expect(typeof response.version).toBe('string');
    expect(response.components).toBeDefined();
    expect(response.components.config.status).toBe('ok');
    expect(response.components.mcp_server.status).toBe('ok');
  });
});
