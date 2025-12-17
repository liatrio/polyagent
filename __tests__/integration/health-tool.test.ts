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
    const result: any = await client.callTool({
      name: 'system/health',
      arguments: {}
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    
    // parse the health response from content
    const textContent = result.content.find((c: any) => c.type === 'text');
    expect(textContent).toBeDefined();
    
    const health = JSON.parse(textContent.text);
    // status can be 'healthy' or 'degraded' depending on framework initialization
    expect(['healthy', 'degraded']).toContain(health.status);
    expect(typeof health.uptime).toBe('number');
    expect(health.uptime).toBeGreaterThan(0);
    expect(typeof health.version).toBe('string');
    expect(health.components).toBeDefined();
    expect(health.components.config.status).toBe('ok');
    expect(health.components.mcp_server.status).toBe('ok');
  });
});
