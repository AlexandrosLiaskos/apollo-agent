# Apollo Agent

```
   █████╗ ██████╗  ██████╗ ██╗     ██╗      ██████╗
  ██╔══██╗██╔══██╗██╔═══██╗██║     ██║     ██╔═══██╗
  ███████║██████╔╝██║   ██║██║     ██║     ██║   ██║
  ██╔══██║██╔═══╝ ██║   ██║██║     ██║     ██║   ██║   
  ██║  ██║██║     ╚██████╔╝███████╗███████╗╚██████╔╝
  ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚══════╝╚══════╝ ╚═════╝
```

**AI-powered coding agent with semantic code understanding and structured reasoning**

Apollo Agent integrates cutting-edge MCP (Model Context Protocol) servers with OpenRouter LLMs to provide intelligent, context-aware assistance for software development tasks. It combines semantic code analysis (Serena), structured problem-solving (Sequential Thinking), and powerful language models to understand and manipulate codebases at a deep level.

<img width="909" height="970" alt="screenshot-2025-12-12_07-06-38" src="https://github.com/user-attachments/assets/d7af0996-a406-4f2f-b9bb-6b1f15c71f84" />

## 🎯 Features

- **🔍 Semantic Code Analysis** - Understands code structure, symbols, and relationships via Serena MCP
- **🧠 Structured Reasoning** - Plans and executes multi-step tasks systematically
- **📚 Knowledge Base** - Maintains context and learnings across sessions
- **🔧 Terminal Integration** - Execute commands with smart sudo handling
- **📊 Symbol Indexing** - Fast code navigation and search
- **🎨 Rich CLI Interface** - Beautiful, informative terminal output

## 🚀 Quick Start

### Prerequisites

**Required:**
- **Node.js** ≥18.0.0 ([install](https://nodejs.org/))
- **uv** - Python package manager ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **Linux** or macOS (primary development platform)

**Optional:**
- OpenRouter API key ([get one](https://openrouter.ai/keys))

### Installation

```bash
# Clone the repository
git clone https://github.com/AlexandrosLiaskos/apollo-agent.git
cd apollo-agent

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your OPENROUTER_API_KEY

# Start Apollo
npm start
```

### First Run

On first startup, Apollo will:
1. Initialize Serena MCP server (via `uvx`)
2. Initialize Sequential Thinking MCP server
3. Connect to OpenRouter
4. Create a terminal session
5. Load available tools (30+ from MCP servers)

```
   █████╗ ██████╗  ██████╗ ██╗     ██╗      ██████╗
  ██╔══██╗██╔══██╗██╔═══██╗██║     ██║     ██╔═══██╗
  ███████║██████╔╝██║   ██║██║     ██║     ██║   ██║
  ██╔══██║██╔═══╝ ██║   ██║██║     ██║     ██║   ██║
  ██║  ██║██║     ╚██████╔╝███████╗███████╗╚██████╔╝
  ╚═╝  ╚═╝╚═╝      ╚═════╝ ╚══════╝╚══════╝ ╚═════╝

  AI Agent with MCP Integration

✔ OpenRouter initialized (model: anthropic/claude-sonnet-4)
✔ Connected to all MCP servers
✔ Loaded 30 tools from MCP servers

? 🚀 Task (or "exit" to quit):
```

## 📖 Usage

### Interactive Mode

Apollo provides an interactive CLI where you can:

**Give tasks:**
```
? 🚀 Task: Refactor the UserService class to use async/await
```

**Use commands:**
```
status          - Show agent status
tasks           - View current task list
knowledge       - List knowledge entries
symbols         - Show symbol index stats
search <name>   - Search for symbols
help            - Show all commands
exit            - Quit Apollo
```

### Example Tasks

**Code Analysis:**
```
? Task: Find all uses of the calculateTotal function
? Task: Show me the structure of the UserController class
? Task: List all API endpoints in this project
```

**Code Modification:**
```
? Task: Add error handling to the login method
? Task: Convert all var declarations to const/let
? Task: Add TypeScript types to user.js
```

**System Operations:**
```
? Task: Install and configure the axios package
? Task: Update all dependencies to latest versions
? Task: Set up ESLint with standard config
```

## 🛠️ Configuration

### Environment Variables

Edit `.env`:

```bash
# OpenRouter Configuration (REQUIRED)
OPENROUTER_API_KEY=your_api_key_here

# Model Selection (optional)
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# Sudo Configuration (see below)
SUDO_MODE=auto  # auto | nopasswd | interactive | password
```

### Sudo Commands

Apollo can execute sudo commands. Configure via `SUDO_MODE`:

**Option 1: Auto (Default)**
```bash
SUDO_MODE=auto
```
Tries passwordless sudo first, falls back to interactive if needed.

**Option 2: Passwordless Sudo (Recommended)**
```bash
# Configure system for passwordless package management
sudo visudo

# Add (replace 'user' with your username):
user ALL=(ALL) NOPASSWD: /usr/bin/pacman
user ALL=(ALL) NOPASSWD: /usr/bin/apt-get
user ALL=(ALL) NOPASSWD: /usr/bin/dnf

# Then in .env:
SUDO_MODE=nopasswd
```

**Option 3: Interactive**
```bash
SUDO_MODE=interactive
```
Apollo pauses and prompts for password when needed.

**Option 4: Password in Env (⚠️ Less Secure)**
```bash
SUDO_MODE=password
SUDO_PASSWORD=your_password
```
Only for personal development with disk encryption.

## 📚 Architecture

### Core Components

**Agent Core** ([`src/agent/apollo-agent.js`](src/agent/apollo-agent.js))
- Main agent orchestration
- Task planning and execution
- Tool coordination

**MCP Integration** ([`src/mcp/serena-client.js`](src/mcp/serena-client.js))
- Connects to Serena (semantic code analysis)
- Connects to Sequential Thinking (structured reasoning)
- Tool registry and execution

**LLM Provider** ([`src/providers/openrouter.js`](src/providers/openrouter.js))
- OpenRouter API integration
- Streaming support
- Multiple model support

**Terminal Tool** ([`src/tools/terminal-tool.js`](src/tools/terminal-tool.js))
- Command execution
- Sudo handling
- Session management

**Knowledge Base** ([`src/agent/knowledge-base.js`](src/agent/knowledge-base.js))
- Persistent memory storage
- Context accumulation
- Cross-session learning

**Symbol Index** ([`src/agent/symbol-index.js`](src/agent/symbol-index.js))
- Fast code symbol search
- File indexing
- Symbol relationships

### MCP Servers

**Serena MCP** ([oraios/serena](https://github.com/oraios/serena))
- Semantic code operations
- Symbol navigation
- Intelligent code editing
- Memory management

**Sequential Thinking MCP** ([@modelcontextprotocol/server-sequential-thinking](https://www.npmjs.com/package/@modelcontextprotocol/server-sequential-thinking))
- Step-by-step reasoning
- Plan validation
- Structured problem solving

## 🔧 Development

### Project Structure

```
apollo-agent/
├── src/
│   ├── index.js              # Entry point
│   ├── agent/
│   │   ├── apollo-agent.js   # Main agent
│   │   ├── task-manager.js   # Task tracking
│   │   ├── knowledge-base.js # Memory system
│   │   └── symbol-index.js   # Code indexing
│   ├── mcp/
│   │   └── serena-client.js  # MCP client manager
│   ├── providers/
│   │   └── openrouter.js     # LLM provider
│   ├── session/
│   │   └── session-manager.js # Session persistence
│   ├── tools/
│   │   ├── api-tools.js      # Tool registry
│   │   └── terminal-tool.js  # Command execution
│   └── ui/
│       └── rich-output.js    # CLI interface
├── package.json
├── .env.example
└── README.md
```

### Running in Development

```bash
# Watch mode (auto-restart on changes)
npm run dev

# Standard mode
npm start
```

### Adding Custom Tools

1. Implement tool in `src/tools/`
2. Register in `ToolRegistry` ([`src/tools/api-tools.js`](src/tools/api-tools.js))
3. Add to agent tool list

### Extending LLM Providers

1. Create provider class in `src/providers/`
2. Implement `chat()` and `chatStream()` methods
3. Update agent initialization

## 🐛 Troubleshooting

### "Serena MCP failed to connect"

**Cause:** `uv` not installed or not in PATH

**Fix:**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify
uv --version
```

### "OpenRouter API error"

**Cause:** Invalid or missing API key

**Fix:**
```bash
# Get API key from https://openrouter.ai/keys
# Add to .env:
echo "OPENROUTER_API_KEY=sk-or-..." >> .env
```

### "Command not found: apollo"

**Cause:** Not installed globally

**Fix:**
```bash
# Option 1: Use npm start
npm start

# Option 2: Install globally
npm install -g .
apollo
```

### "sudo: a password is required"

**Cause:** Passwordless sudo not configured

**Fix:**
```bash
# Configure in .env:
SUDO_MODE=interactive

# Or setup passwordless sudo (see Configuration section)
```

## 📊 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | Linux, macOS | Arch Linux, Ubuntu 22.04+ |
| **Node.js** | 18.0.0 | 20.0.0+ |
| **RAM** | 2GB | 4GB+ |
| **Storage** | 500MB | 1GB+ |
| **Network** | Required | High-speed |

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Serena MCP](https://github.com/oraios/serena) - Semantic code operations
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [OpenRouter](https://openrouter.ai/) - LLM API aggregation
- [Anthropic Claude](https://anthropic.com/) - Default language model

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/AlexandrosLiaskos/apollo-agent/issues)
- **Discussions:** [GitHub Discussions](https://github.com/AlexandrosLiaskos/apollo-agent/discussions)

---

Built with ❤️ by Alexandros Liaskos
