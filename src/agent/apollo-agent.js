import { MCPClientManager } from '../mcp/serena-client.js';
import { OpenRouterProvider } from '../providers/openrouter.js';
import { TerminalTool } from '../tools/terminal-tool.js';
import { ToolRegistry } from '../tools/api-tools.js';
import { RichOutput } from '../ui/rich-output.js';
import { SessionManager } from '../session/session-manager.js';
import { TaskManager } from './task-manager.js';
import { KnowledgeBase } from './knowledge-base.js';
import { SymbolIndex } from './symbol-index.js';
import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Apollo Agent - AI Agent with MCP integration
 *
 * Uses:
 * - Serena MCP (https://github.com/oraios/serena) for semantic code operations
 * - Sequential Thinking MCP for structured problem solving
 * - OpenRouter as the LLM provider
 */
export class ApolloAgent {
  constructor(options = {}) {
    this.mcp = new MCPClientManager();
    this.llm = null; // Initialized in initialize()
    this.terminal = new TerminalTool({
      sudoPassword: options.sudoPassword,
      sudoMode: options.sudoMode
    });
    this.tools = new ToolRegistry();
    this.ui = new RichOutput();
    this.session = new SessionManager();
    this.taskManager = new TaskManager();
    this.knowledgeBase = new KnowledgeBase();
    this.symbolIndex = null; // Initialized after knowledgeBase
    this.projectPath = options.projectPath || process.cwd();
    this.terminalSession = null;
    this.allTools = [];
    this.conversationHistory = [];
    this.availableMemories = []; // Loaded from Serena memory system
    this.planningMode = true; // Start with planning phase
  }

  async initialize() {
    // Production-ready ASCII banner
    console.log(chalk.cyan('\n' + 
      '   █████╗ ██████╗  ██████╗ ██╗     ██╗      ██████╗\n' +
      '  ██╔══██╗██╔══██╗██╔═══██╗██║     ██║     ██╔═══██╗\n' +
      '  ███████║██████╔╝██║   ██║██║     ██║     ██║   ██║\n' +
      '  ██╔══██║██╔═══╝ ██║   ██║██║     ██║     ██║   ██║\n' +
      '  ██║  ██║██║     ╚██████╔╝███████╗███████╗╚██████╔╝\n' +
      '  ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚══════╝╚══════╝ ╚═════╝\n'));
    console.log(chalk.gray('  AI Agent with MCP Integration\n'));
    
    this.ui.info('Using Serena MCP + Sequential Thinking MCP + OpenRouter');

    // Initialize OpenRouter LLM provider
    this.ui.startSpinner('Initializing OpenRouter...');
    try {
      this.llm = new OpenRouterProvider();
      this.ui.stopSpinner(true, `OpenRouter initialized (model: ${this.llm.model})`);
    } catch (error) {
      this.ui.stopSpinner(false, 'Failed to initialize OpenRouter');
      this.ui.error(`Error: ${error.message}`);
      throw error;
    }

    // Initialize session
    this.ui.startSpinner('Initializing session manager...');
    await this.session.initialize();
    await this.session.createSession({ agent: 'apollo', version: '1.0.0' });
    this.ui.stopSpinner(true, 'Session initialized');

    // Initialize knowledge base
    this.ui.startSpinner('Initializing knowledge base...');
    await this.knowledgeBase.initialize();
    this.ui.stopSpinner(true, 'Knowledge base initialized');

    // Initialize symbol index
    this.ui.startSpinner('Loading symbol index...');
    this.symbolIndex = new SymbolIndex(this.knowledgeBase);
    await this.symbolIndex.initialize();
    const indexStats = this.symbolIndex.getStats();
    this.ui.stopSpinner(true, `Symbol index loaded (${indexStats.filesIndexed} files, ${indexStats.symbolsCount} symbols)`);

    // Connect to MCP servers
    this.ui.startSpinner('Connecting to MCP servers...');
    const results = await this.mcp.connectAll(this.projectPath);

    if (results.errors.length > 0) {
      this.ui.stopSpinner(false, 'Some MCP servers failed to connect');
      for (const err of results.errors) {
        this.ui.warning(`${err.server}: ${err.error}`);
      }
    } else {
      this.ui.stopSpinner(true, 'Connected to all MCP servers');
    }

    // List available tools from connected MCPs
    await this.loadMCPTools();

    this.terminalSession = this.terminal.createSession('main');
    this.ui.success('Terminal session created');
  }

  async loadMCPTools() {
    this.ui.startSpinner('Loading MCP tools...');
    try {
      const toolsMap = await this.mcp.listAllTools();
      this.allTools = [];

      for (const [server, tools] of Object.entries(toolsMap)) {
        if (Array.isArray(tools)) {
          for (const tool of tools) {
            // Skip Serena's execute_shell_command - we'll use our local one
            if (tool.name === 'execute_shell_command' && server === 'serena') {
              continue;
            }
            this.allTools.push({
              ...tool,
              _server: server,
            });
          }
        }
      }

      // Add local shell command tool with sudo support
      this.allTools.push({
        name: 'execute_shell_command',
        description: 'Execute a shell command with optional sudo support. Use this for system operations that may require elevated privileges.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the command (optional)'
            },
            requiresSudo: {
              type: 'boolean',
              description: 'Whether this command requires sudo privileges (optional, auto-detected for commands starting with "sudo")'
            }
          },
          required: ['command']
        },
        _server: 'local',
        _isLocal: true
      });

      this.ui.stopSpinner(true, `Loaded ${this.allTools.length} tools from MCP servers`);

      // Load available memories for context
      await this.loadAvailableMemories();
    } catch (error) {
      this.ui.stopSpinner(false, 'Failed to load MCP tools');
      this.ui.warning(error.message);
    }
  }

  /**
   * Load available memories from Serena for context
   */
  async loadAvailableMemories() {
    try {
      if (!this.mcp.isConnected('serena')) return;

      const result = await this.mcp.callTool('serena', 'list_memories', {});
      if (result.content) {
        const textContent = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');

        try {
          this.availableMemories = JSON.parse(textContent);
          if (this.availableMemories.length > 0) {
            this.ui.info(`Found ${this.availableMemories.length} memories available`);
          }
        } catch {
          this.availableMemories = [];
        }
      }
    } catch (error) {
      this.availableMemories = [];
      // Silently fail - memories are optional
    }
  }

  /**
   * Set the working project directory
   */
  async setProject(projectPath) {
    this.projectPath = projectPath;
    this.session.updateContext({ projectPath });
    await this.session.saveSession();
    this.ui.success(`Project set to: ${projectPath}`);
    return projectPath;
  }

  /**
   * Process a task using the LLM with MCP tools
   */
  async processTask(taskDescription) {
    this.ui.section('🎯 Task Processing');
    this.session.addMessage('user', taskDescription);

    // Phase 1: Planning and Intelligence Gathering
    if (this.planningMode) {
      await this.planningPhase(taskDescription);
    }

    // Add user message to conversation
    this.conversationHistory.push({
      role: 'user',
      content: taskDescription,
    });

    // Create system prompt
    const systemPrompt = this.buildSystemPrompt();

    // Build messages for LLM
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
    ];

    this.ui.startSpinner('Thinking with OpenRouter...');

    try {
      // Execute agent loop with tool calling
      const result = await this.llm.runAgentLoop(
        messages,
        this.allTools,
        this.executeMCPTool.bind(this),
        { 
          maxIterations: 25,
          onToolCall: (toolName, args) => {
            // Update task status based on tool calls
            this.updateTaskProgress(toolName, args);
          }
        }
      );

      this.ui.stopSpinner(true, `Completed in ${result.iterations} steps`);

      // Show final task status
      if (this.taskManager.tasks.length > 0) {
        this.ui.taskList(this.taskManager.tasks, this.taskManager.getProgress());
        
        // Check if all tasks are completed
        if (!this.taskManager.isComplete()) {
          this.ui.warning('Not all tasks completed. Review the task list above.');
        } else {
          this.ui.success('All tasks completed successfully!');
        }
      }

      // Add assistant response to history
      if (result.content) {
        this.conversationHistory.push({
          role: 'assistant',
          content: result.content,
        });
        this.ui.block('Response', result.content, 'success');
      }

      await this.session.saveSession();
      return result;

    } catch (error) {
      this.ui.stopSpinner(false, 'Task failed');
      this.ui.error(`Error: ${error.message}`);
      
      // Mark current task as failed
      const currentTask = this.taskManager.tasks.find(t => t.status === 'in-progress');
      if (currentTask) {
        this.taskManager.failTask(currentTask.id, error.message);
      }
      
      throw error;
    }
  }


  async planningPhase(taskDescription) {
    this.ui.section('🧠 Planning Phase');
    this.ui.info('Analyzing task and creating execution plan...');

    // Use LLM to analyze the task and create a plan
    const planningPrompt = `You are a planning assistant. Analyze this task and create an execution plan.

Task: ${taskDescription}

Provide a JSON response with:
1. A brief summary of the task
2. Key information needed (intel to gather)
3. A list of concrete steps/tasks to complete it
4. Any dependencies between tasks
5. Estimated complexity (simple/moderate/complex)

Format as JSON:
{
  "summary": "brief task summary",
  "intel_needed": ["info1", "info2"],
  "tasks": [
    {"name": "task name", "type": "task", "priority": "normal", "dependencies": []}
  ],
  "complexity": "moderate"
}`;

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are a planning assistant. Always respond with valid JSON.' },
        { role: 'user', content: planningPrompt }
      ]);

      // Extract content from OpenRouter response
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        
        // Show the plan
        this.ui.plan(plan.summary, plan.tasks);

        // Ask user for confirmation
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with this plan?',
            default: true
          }
        ]);

        if (confirm) {
          // Create tasks in task manager
          this.taskManager.createPlan(plan.summary, plan.tasks);
          
          // Store intel needs in knowledge base
          if (plan.intel_needed && plan.intel_needed.length > 0) {
            await this.knowledgeBase.storeIntel('task-requirements', 
              `Intel needed for: ${taskDescription}\n\n${plan.intel_needed.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`,
              { task: taskDescription }
            );
          }

          this.ui.success('Plan created and tasks initialized');
        } else {
          this.ui.info('Planning cancelled. Proceeding with ad-hoc execution.');
          this.planningMode = false;
        }
      } else {
        this.ui.warning('Could not parse planning response. Proceeding without plan.');
        this.planningMode = false;
      }
    } catch (error) {
      this.ui.warning(`Planning failed: ${error.message}. Proceeding without plan.`);
      this.planningMode = false;
    }
  }

  updateTaskProgress(toolName, args) {
    // Auto-detect task progress based on tool usage
    const nextTask = this.taskManager.getNextTask();
    
    if (nextTask && nextTask.status === 'pending') {
      this.taskManager.startTask(nextTask.id);
      this.ui.info(`Starting task: ${nextTask.name}`);
    }

    // Show current progress periodically
    if (this.taskManager.tasks.length > 0) {
      const progress = this.taskManager.getProgress();
      this.ui.updateSpinner(`Progress: ${progress.percentage}% (${progress.completed}/${progress.total} tasks)`);
    }
  }

  async viewKnowledge(category = null) {
    const memories = category 
      ? await this.knowledgeBase.listByCategory(category)
      : Object.values(await this.knowledgeBase.listAll()).flat();
    
    this.ui.knowledgeList(memories, category);
    return memories;
  }

  async viewKnowledgeDetail(name) {
    const memory = await this.knowledgeBase.retrieve(name);
    if (memory) {
      this.ui.knowledgeDetail(memory);
    } else {
      this.ui.error(`Knowledge entry '${name}' not found`);
    }
    return memory;
  }

  async editKnowledge(name, newContent) {
    try {
      const updated = await this.knowledgeBase.update(name, newContent);
      this.ui.success(`Updated knowledge: ${name}`);
      return updated;
    } catch (error) {
      this.ui.error(`Failed to update knowledge: ${error.message}`);
      throw error;
    }
  }

  async storeKnowledge(name, content, category = 'intel', metadata = {}) {
    const memory = await this.knowledgeBase.store(name, content, category, metadata);
    this.ui.success(`Stored knowledge: ${name} (${category})`);
    return memory;
  }

  viewTasks() {
    if (this.taskManager.tasks.length === 0) {
      this.ui.info('No tasks in current plan');
      return;
    }

    this.ui.taskList(this.taskManager.tasks, this.taskManager.getProgress());
  }

  completeCurrentTask(result = null) {
    const currentTask = this.taskManager.tasks.find(t => t.status === 'in-progress');
    if (currentTask) {
      this.taskManager.completeTask(currentTask.id, result);
      this.ui.success(`Completed: ${currentTask.name}`);
      
      // Show updated progress
      this.ui.taskList(this.taskManager.tasks, this.taskManager.getProgress());
    }
  }


  /**
   * Get symbols for a file - checks cache first, then calls Serena if needed
   */
  async getFileSymbols(filePath, options = {}) {
    const { depth = 0, forceRefresh = false } = options;

    // Check if we should use cached version
    if (!forceRefresh) {
      const cached = await this.symbolIndex.getSymbols(filePath, this.projectPath);
      if (cached) {
        this.ui.info(`Using cached symbols for ${filePath}`);
        return cached.symbols;
      }
    }

    // Not cached or stale - fetch from Serena
    this.ui.info(`Fetching symbols for ${filePath} from Serena...`);
    
    try {
      const result = await this.mcp.callTool('serena', 'mcp_oraios_serena_get_symbols_overview', {
        relative_path: filePath,
        depth
      });

      if (result && result.result) {
        const symbols = JSON.parse(result.result);
        
        // Cache the result
        await this.symbolIndex.indexFile(filePath, symbols, this.projectPath);
        this.ui.success(`Indexed ${symbols.length} symbols from ${filePath}`);
        
        return symbols;
      }
    } catch (error) {
      this.ui.warning(`Failed to get symbols: ${error.message}`);
      return null;
    }
  }

  /**
   * Search for symbols across the codebase - uses index for fast lookup
   */
  async searchSymbolsInIndex(symbolName, options = {}) {
    const results = this.symbolIndex.searchSymbols(symbolName, options);
    
    if (results.length === 0) {
      this.ui.info(`No cached symbols found for "${symbolName}". Consider indexing more files.`);
    } else {
      this.ui.success(`Found ${results.length} symbol(s) for "${symbolName}" in index`);
    }

    return results;
  }

  /**
   * Index multiple files at once
   */
  async indexFiles(filePaths, depth = 1) {
    this.ui.section('📇 Indexing Files');
    
    let indexed = 0;
    let failed = 0;

    for (const filePath of filePaths) {
      try {
        // Check if needs reindexing
        const needsUpdate = await this.symbolIndex.needsReindexing(filePath, this.projectPath);
        
        if (!needsUpdate) {
          this.ui.info(`Skipping ${filePath} (already indexed)`);
          continue;
        }

        await this.getFileSymbols(filePath, { depth, forceRefresh: true });
        indexed++;
      } catch (error) {
        this.ui.warning(`Failed to index ${filePath}: ${error.message}`);
        failed++;
      }
    }

    const stats = this.symbolIndex.getStats();
    this.ui.success(`Indexed ${indexed} files (${failed} failed). Total: ${stats.filesIndexed} files, ${stats.symbolsCount} symbols`);
    
    return { indexed, failed, stats };
  }

  /**
   * View symbol index statistics
   */
  viewSymbolIndex() {
    const stats = this.symbolIndex.getStats();
    
    this.ui.section('📇 Symbol Index Statistics');
    console.log();
    console.log(chalk.bold.white('Total Files Indexed: ') + chalk.cyan(stats.filesIndexed));
    console.log(chalk.bold.white('Total Symbols: ') + chalk.cyan(stats.symbolsCount));
    console.log(chalk.bold.white('Cache Size: ') + chalk.cyan(stats.cacheSize + ' files'));
    
    if (stats.lastFullScan) {
      console.log(chalk.bold.white('Last Full Scan: ') + chalk.gray(new Date(stats.lastFullScan).toLocaleString()));
    }

    if (stats.categories && Object.keys(stats.categories).length > 0) {
      console.log();
      console.log(chalk.bold.white('Symbols by Kind:'));
      Object.entries(stats.categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([kind, count]) => {
          console.log(chalk.gray(`  ${kind}: `) + chalk.white(count));
        });
    }
    console.log();
  }

  /**
   * Clear the symbol index
   */
  async clearSymbolIndex() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Clear entire symbol index?',
        default: false
      }
    ]);

    if (confirm) {
      await this.symbolIndex.clear();
      this.ui.success('Symbol index cleared');
    }
  }

  /**
   * Invalidate cache for specific files
   */
  async invalidateSymbolCache(filePaths) {
    for (const filePath of filePaths) {
      await this.symbolIndex.invalidate(filePath);
    }
    this.ui.success(`Invalidated cache for ${filePaths.length} file(s)`);
  }

  /**
   * Build the system prompt for the LLM
   */
  buildSystemPrompt() {
    // Group tools by category for better understanding
    const serenaTools = this.allTools.filter(t => t._server === 'serena');
    const thinkingTools = this.allTools.filter(t => t._server === 'sequential-thinking');

    const formatTool = (t) => `  - ${t.name}: ${(t.description || 'No description').slice(0, 100)}`;

    // Add task context if tasks exist
    let taskContext = '';
    if (this.taskManager.tasks.length > 0) {
      const progress = this.taskManager.getProgress();
      const currentTask = this.taskManager.tasks.find(t => t.status === 'in-progress');
      const nextTask = this.taskManager.getNextTask();
      
      taskContext = `\n## 📋 CURRENT EXECUTION PLAN
${this.taskManager.currentPlan ? `Objective: ${this.taskManager.currentPlan.description}\n` : ''}
Progress: ${progress.completed}/${progress.total} tasks completed (${progress.percentage}%)

${currentTask ? `**Current Task**: ${currentTask.name}` : ''}
${nextTask ? `**Next Task**: ${nextTask.name}` : ''}

**IMPORTANT**: 
- Stay focused on completing the current task
- Mark tasks as complete by finishing the work
- Don't finish until ALL tasks are completed
- If a task is done, move to the next one
- Store important findings in the knowledge base

All Tasks:
${this.taskManager.tasks.map((t, i) => {
  const status = t.status === 'completed' ? '✓' : 
                 t.status === 'in-progress' ? '▶' : 
                 t.status === 'failed' ? '✗' : '○';
  return `${status} ${i + 1}. ${t.name} [${t.status}]`;
}).join('\n')}
`;
    }

    return `You are Apollo, an AI coding agent with powerful capabilities through MCP tools.

## Current Project
Path: ${this.projectPath}
${taskContext}

## 🌐 FILESYSTEM ACCESS
You have GLOBAL filesystem access via shell commands (execute_shell_command).
- Serena's file tools (read_file, create_text_file, etc.) are restricted to the project directory above
- BUT execute_shell_command can access ANY path on the system (e.g., \`ls /home\`, \`cat /etc/hosts\`)
- You CAN navigate to, read from, and write to directories outside the project using shell commands
- Use commands like: cd, ls, cat, cp, mv, mkdir, touch, etc. with absolute paths
- Example: execute_shell_command({ command: "ls -la /home/wan/other-project" })

## ⚠️ MANDATORY FIRST STEPS (DO THIS BEFORE ANY ACTION)

1. **ACT AS A PROPER AGENT**:
   - Gather intelligence before acting
   - Create and follow execution plans
   - Track progress systematically
   - Store important knowledge for later use
   - Don't finish until objectives are met

2. **USE SEQUENTIAL THINKING FIRST** - For ANY task, start by calling sequential_thinking to:
   - State what you understand the user wants
   - Break down the steps needed
   - Identify any ambiguities or questions

3. **CONFIRM UNDERSTANDING** - Your FIRST response to the user should be:
   "I understand you want to [X]. Here's my plan:
   1. [step 1]
   2. [step 2]
   Does this look right, or would you like to clarify anything?"

4. **WAIT FOR CONFIRMATION** on complex or potentially destructive tasks before executing

NEVER skip these steps and jump straight to tool execution!

## Your Capabilities

### 1. Shell Command Execution (execute_shell_command) - GLOBAL ACCESS
You CAN execute ANY shell command with FULL system access:
- curl, wget for HTTP requests (e.g., GitHub API, web searches)
- git commands (clone repos anywhere, check status of any repo)
- npm, pip, cargo, etc.
- File operations ANYWHERE: ls, cat, cp, mv, mkdir, rm, find, grep on ANY path
- Access ANY directory: cd to /home, /tmp, other projects, etc.
Example: execute_shell_command({ command: "ls -la /home/wan/projects" })
Example: execute_shell_command({ command: "cat /etc/os-release" })

⚠️ LIMITATIONS:
- Commands run in background - NO interactive input (no sudo password, no prompts)
- For commands needing sudo, warn user they may need to run manually
- For long operations (git clone), warn user it may take time
- Always tell the user WHAT COMMAND you're about to run before running it

💡 TIP: When user asks to access files outside the project, USE execute_shell_command with absolute paths!

### 2. Code Navigation & Editing (Serena Tools)
${serenaTools.map(formatTool).join('\n')}

### 3. Structured Thinking (Sequential Thinking)
${thinkingTools.map(formatTool).join('\n')}

### 4. Memory System
IMPORTANT: Use memory tools to persist information across conversation turns!
- write_memory: Save results, summaries, or important data for later use
- read_memory: Retrieve previously saved information
- list_memories: See what memories exist
Before re-running a command, CHECK if results are already in memory!
${this.availableMemories && this.availableMemories.length > 0 ? `\n**Available Memories (use read_memory to access):**\n${this.availableMemories.map(m => `  - ${m}`).join('\n')}` : ''}

### 5. Knowledge Base (Built-in)
Store and retrieve knowledge during task execution:
- Use knowledgeBase to store intel gathered
- Categories: intel, context, decisions, findings, references, symbols
- Store important information as you discover it
- Reference stored knowledge in future steps

### 6. Symbol Index (Intelligent Caching)
**IMPORTANT**: Apollo has an intelligent symbol caching system!
- When you call Serena tools to get symbols, they are automatically cached
- Cached symbols are stored with file hashes to detect changes
- Before calling get_symbols_overview, the cache is checked AUTOMATICALLY
- You NEVER need to manually check - it's handled transparently
- File changes invalidate cache automatically (hash-based detection)
- Massive performance improvement - no repeated MCP calls for same files

**How it works**:
1. First time you get symbols for a file → Calls Serena, caches result
2. Next time you need same file → Returns cached version instantly (if file unchanged)
3. If file modified → Detects change via hash, fetches fresh symbols

**Benefits**:
- 100x faster symbol lookups for unchanged files
- Persists across agent sessions
- Automatic invalidation on file changes
- Search across all indexed symbols instantly

You don't need to do anything special - just use Serena tools normally!

## Guidelines

### Agent Behavior
- **Gather Intel First**: Before taking action, gather necessary information
- **Store Knowledge**: Save important findings to the knowledge base
- **Track Progress**: Update task status as you work
- **Systematic Approach**: Follow the plan, complete tasks in order
- **Don't Give Up**: Keep working until all tasks are complete

### Handling Long Outputs
When output is too long or overwhelming:
1. ASK the user what they prefer:
   - "Should I save this to a file?"
   - "Would you like just the top 5 results?"
   - "I can give you the command to run yourself"
   - "Should I summarize the key findings?"
2. Use memory to store results: write_memory({ memory_file_name: "search_results.md", content: "..." })

### Efficiency
- Check list_memories FIRST if you might have relevant cached data
- Don't repeat the same command - use stored results
- If a task was just done, reference the previous result

### Using Tools
- ALWAYS try to use your tools rather than saying you cannot do something
- For file operations: use the file tools (read_file, create_text_file, etc.)

### Searching (GitHub, Web, etc.)
- GitHub API requires exact spelling - it won't fuzzy match typos
- If GitHub search returns 0 results:
  1. Try a WEB SEARCH first (more forgiving): curl 'https://html.duckduckgo.com/html?q=TERM+github' | grep -o 'https://github.com/[^"]*' | head -5
  2. Ask user: "No results for 'X'. Did you mean something else? Or I can search the web for similar names."
  3. Try partial matches or common variations
- ALWAYS report when a search finds nothing - don't just silently retry with same query

### Communication
- Explain what you're doing and why
- Offer alternatives when something fails
- If something is ambiguous (e.g., "cats" could mean animal or command), ASK before acting

## Sequential Thinking Usage
ALWAYS use sequential_thinking as your FIRST tool call for any task:
\`\`\`
sequential_thinking({
  thought: "User wants X. My understanding: ... Steps needed: 1) ... 2) ... Questions: ...",
  thoughtNumber: 1,
  totalThoughts: 3,
  nextThoughtNeeded: true
})
\`\`\`
Then RESPOND to user with your understanding before executing other tools.`;
  }

  /**
   * Execute an MCP tool
   */
  async executeMCPTool(toolName, args) {
    const tool = this.allTools.find(t => t.name === toolName);
    if (!tool) {
      return { error: `Unknown tool: ${toolName}` };
    }

    const serverName = tool._server;
    const isLocal = tool._isLocal;

    // Show more details for shell commands so user knows what's happening
    if (toolName === 'execute_shell_command') {
      this.ui.info(`🔧 Executing${isLocal ? ' (with sudo support)' : ''}: ${args.command || 'unknown command'}`);
      if (args.cwd) {
        this.ui.info(`   in directory: ${args.cwd}`);
      }
    } else if (toolName === 'sequentialthinking') {
      // Don't log for sequential thinking - we'll show the thought box
    } else {
      this.ui.info(`Calling ${serverName}/${toolName}...`);
    }

    try {
      let result;
      
      // Handle local tools
      if (isLocal && toolName === 'execute_shell_command') {
        const terminalResult = await this.terminal.execute(args.command, {
          cwd: args.cwd,
          session: 'main'
        });
        
        // Format as MCP response
        result = {
          content: [{
            type: 'text',
            text: JSON.stringify({
              stdout: terminalResult.stdout || '',
              stderr: terminalResult.stderr || '',
              return_code: terminalResult.success ? 0 : (terminalResult.exitCode || 1)
            })
          }]
        };
      } else {
        // Call MCP tool
        result = await this.mcp.callTool(serverName, toolName, args);
      }
      
      this.session.addToolExecution(toolName, args, result);

      // Show sequential thinking output nicely
      if (toolName === 'sequentialthinking' && args) {
        const thoughtNum = args.thoughtNumber || '?';
        const totalNum = args.totalThoughts || '?';
        this.ui.block(`💭 Thought ${thoughtNum}/${totalNum}`, args.thought || '', 'thinking');
      }

      // Show shell command output to user immediately (parsed nicely)
      if (toolName === 'execute_shell_command' && result.content) {
        const rawOutput = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');

        if (rawOutput) {
          // Parse the JSON response from shell command
          let displayOutput = rawOutput;
          try {
            const parsed = JSON.parse(rawOutput);
            // Combine stdout and stderr for display
            const stdout = parsed.stdout || '';
            const stderr = parsed.stderr || '';
            const returnCode = parsed.return_code;

            displayOutput = stdout || stderr || '(no output)';
            if (stderr && stdout) {
              displayOutput = stdout + '\n[stderr]: ' + stderr;
            }
            if (returnCode !== 0 && returnCode !== undefined) {
              displayOutput += `\n[exit code: ${returnCode}]`;
            }
          } catch {
            // Not JSON, use as-is
          }

          // Show first few lines
          const lines = displayOutput.split('\n');
          const preview = lines.slice(0, 15).join('\n');
          if (preview.trim()) {
            this.ui.block('Output', preview + (lines.length > 15 ? `\n... (${lines.length - 15} more lines)` : ''), 'info');
          }
        }
      }

      // Format result
      let textContent = '';
      if (result.content) {
        textContent = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        textContent = textContent || JSON.stringify(result.content);
      } else {
        textContent = JSON.stringify(result);
      }

      // Add metadata for long outputs to help LLM make decisions
      const charCount = textContent.length;
      const lineCount = textContent.split('\n').length;

      if (charCount > 5000 || lineCount > 100) {
        const preview = textContent.slice(0, 2000);
        const truncatedMsg = `\n\n[OUTPUT TRUNCATED: Full result is ${charCount} chars, ${lineCount} lines. ` +
          `Consider: (1) saving to memory with write_memory, (2) asking user if they want a summary, ` +
          `(3) providing just key findings, or (4) giving the user the command to run themselves.]`;
        return preview + truncatedMsg;
      }

      return textContent;
    } catch (error) {
      this.ui.warning(`Tool error: ${error.message}`);
      return { error: error.message };
    }
  }

  async executeTasks(analysis) {
    this.ui.section('⚙️  Task Execution');

    for (const globalTask of analysis.globalTasks) {
      this.ui.info(`Starting: ${globalTask.name}`);

      const serenaTask = await this.createSerenaTask(globalTask, analysis.subTasks[globalTask.id]);

      const subTasks = analysis.subTasks[globalTask.id] || [];
      for (const subTask of subTasks) {
        await this.executeSubTask(subTask, globalTask);
      }

      await this.updateSerenaTask(serenaTask.id, { status: 'completed' });
      this.ui.success(`Completed: ${globalTask.name}`);
    }

    await this.session.saveSession();
    this.ui.success('All tasks completed!');
  }

  async createSerenaTask(globalTask, subTasks) {
    try {
      const response = await this.serena.createTask({
        title: globalTask.name,
        description: `Subtasks: ${subTasks.map(s => s.name).join(', ')}`,
        status: 'in_progress'
      });
      return this.parseTaskResponse(response);
    } catch (error) {
      this.ui.warning(`Could not create Serena task: ${error.message}`);
      return { id: `local_${Date.now()}` };
    }
  }

  async updateSerenaTask(taskId, updates) {
    try {
      await this.serena.updateTask(taskId, updates);
    } catch (error) {
      this.ui.warning(`Could not update Serena task: ${error.message}`);
    }
  }

  parseTaskResponse(response) {
    if (Array.isArray(response) && response[0]?.text) {
      try {
        return JSON.parse(response[0].text);
      } catch {
        return { id: response[0].text };
      }
    }
    return response;
  }

  async executeSubTask(subTask, parentTask) {
    this.ui.info(`  ├─ ${subTask.name}`);

    const action = this.determineAction(subTask.name);
    let result;

    try {
      switch (action.type) {
        case 'terminal':
          result = await this.executeTerminalAction(action);
          break;
        case 'search':
          result = await this.executeSearchAction(action);
          break;
        case 'read':
          result = await this.executeReadAction(action);
          break;
        case 'install':
          result = await this.executeInstallAction(action);
          break;
        default:
          result = await this.executeGenericAction(action, subTask);
      }

      this.session.addToolExecution(action.type, action, result);
      this.ui.toolExecution(action.type, action, result);

      if (!result.success && result.error) {
        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: `Task failed: ${result.error}. Retry?`,
            default: false
          }
        ]);

        if (retry) {
          return await this.executeSubTask(subTask, parentTask);
        }
      }

    } catch (error) {
      this.ui.error(`Failed: ${error.message}`);

      const { continueExecution } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueExecution',
          message: 'Continue with remaining tasks?',
          default: true
        }
      ]);

      if (!continueExecution) {
        throw new Error('Execution stopped by user');
      }
    }
  }

  determineAction(taskName) {
    const lower = taskName.toLowerCase();

    if (lower.includes('install') || lower.includes('package')) {
      return { type: 'install', task: taskName };
    }
    if (lower.includes('search') || lower.includes('find')) {
      return { type: 'search', task: taskName };
    }
    if (lower.includes('read') || lower.includes('view') || lower.includes('check')) {
      return { type: 'read', task: taskName };
    }
    if (lower.includes('run') || lower.includes('execute') || lower.includes('command')) {
      return { type: 'terminal', task: taskName };
    }

    return { type: 'generic', task: taskName };
  }

  async executeTerminalAction(action) {
    const { command } = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: `Enter command for "${action.task}":`,
        default: this.suggestCommand(action.task)
      }
    ]);

    return await this.terminal.execute(command, { session: this.terminalSession });
  }

  async executeSearchAction(action) {
    const { searchType, query } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchType',
        message: 'Search where?',
        choices: ['GitHub', 'NPM', 'PyPI', 'Wikipedia', 'Local Files']
      },
      {
        type: 'input',
        name: 'query',
        message: 'Search query:'
      }
    ]);

    switch (searchType) {
      case 'GitHub':
        return await this.tools.getGitHub().searchRepositories(query);
      case 'NPM':
        return await this.tools.getNPM().searchPackages(query);
      case 'PyPI':
        return await this.tools.getPyPI().searchPackages(query);
      case 'Wikipedia':
        return await this.tools.getWikipedia().search(query);
      case 'Local Files':
        return await this.terminal.execute(`find . -name "*${query}*"`, { session: this.terminalSession });
      default:
        return { success: false, error: 'Unknown search type' };
    }
  }

  async executeReadAction(action) {
    const pwdResult = await this.terminal.pwd(this.terminalSession);
    this.ui.info(`Current directory: ${pwdResult.stdout}`);

    const lsResult = await this.terminal.ls('.', this.terminalSession);
    this.ui.block('Directory Contents', lsResult.stdout, 'info');

    const { path } = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: 'Enter path to read:'
      }
    ]);

    return await this.terminal.readFile(path, this.terminalSession);
  }

  async executeInstallAction(action) {
    const { packageManager, packageName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'packageManager',
        message: 'Package manager:',
        choices: ['npm', 'pip', 'apt', 'brew']
      },
      {
        type: 'input',
        name: 'packageName',
        message: 'Package name:'
      }
    ]);

    return await this.terminal.installPackage(packageManager, packageName, this.terminalSession);
  }

  async executeGenericAction(action, subTask) {
    this.ui.thinkingBlock('Generic Action', `Determining how to execute: ${subTask.name}`);

    const { actionType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'actionType',
        message: `How should I execute "${subTask.name}"?`,
        choices: [
          'Run terminal command',
          'Search for information',
          'Read file/directory',
          'Skip this step',
          'Manual intervention needed'
        ]
      }
    ]);

    switch (actionType) {
      case 'Run terminal command':
        return await this.executeTerminalAction(action);
      case 'Search for information':
        return await this.executeSearchAction(action);
      case 'Read file/directory':
        return await this.executeReadAction(action);
      case 'Skip this step':
        return { success: true, skipped: true };
      case 'Manual intervention needed':
        this.ui.warning('Waiting for manual intervention...');
        await inquirer.prompt([{ type: 'input', name: 'done', message: 'Press Enter when done...' }]);
        return { success: true, manual: true };
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  suggestCommand(taskName) {
    const lower = taskName.toLowerCase();
    if (lower.includes('list') || lower.includes('view')) return 'ls -la';
    if (lower.includes('directory') || lower.includes('folder')) return 'pwd';
    if (lower.includes('install')) return 'npm install';
    if (lower.includes('test')) return 'npm test';
    if (lower.includes('build')) return 'npm run build';
    return '';
  }

  async shutdown() {
    this.ui.section('👋 Shutting Down');

    if (this.session.getCurrentSession()) {
      await this.session.saveSession();
      this.ui.success('Session saved');
    }

    await this.mcp.disconnectAll();
    this.ui.success('Disconnected from MCP servers');

    this.ui.info('Goodbye!');
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.ui.success('Conversation history cleared');
  }

  /**
   * Get a summary of connected MCPs
   */
  getStatus() {
    return {
      llm: {
        provider: 'OpenRouter',
        model: this.llm?.model,
      },
      mcp: {
        serena: this.mcp.isConnected('serena'),
        sequentialThinking: this.mcp.isConnected('sequential-thinking'),
      },
      project: this.projectPath,
      toolCount: this.allTools.length,
    };
  }
}
