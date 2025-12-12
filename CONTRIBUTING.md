# Contributing to Apollo Agent

Thank you for your interest in contributing to Apollo Agent! This document provides guidelines and information for contributors.

## 🎯 Ways to Contribute

- **Bug Reports** - Report issues you encounter
- **Feature Requests** - Suggest new features or improvements
- **Code Contributions** - Submit pull requests with fixes or features
- **Documentation** - Improve docs, add examples, fix typos
- **Testing** - Test on different platforms, report compatibility issues

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- uv (Python package manager)
- Git
- Linux or macOS (primary development platforms)

### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/apollo-agent.git
cd apollo-agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your OpenRouter API key to .env
nano .env

# Run in development mode
npm run dev
```

## 📝 Code Standards

### JavaScript Style

- **ES Modules** - Use `import`/`export`, not `require`
- **Async/Await** - Prefer over callbacks or raw promises
- **Descriptive Names** - Clear variable and function names
- **Comments** - Document complex logic
- **Error Handling** - Always handle errors appropriately

### Code Organization

```javascript
// Good: Clear, documented, error-handled
async function processUserTask(taskInput) {
  try {
    // Validate input
    if (!taskInput || typeof taskInput !== 'string') {
      throw new Error('Invalid task input');
    }

    // Process task
    const result = await this.executeTask(taskInput);
    return result;
  } catch (error) {
    console.error('Task processing failed:', error);
    throw error;
  }
}
```

### File Structure

- Keep files focused on single responsibility
- Place new features in appropriate directories:
  - `src/agent/` - Core agent logic
  - `src/tools/` - Tool implementations
  - `src/providers/` - LLM provider integrations
  - `src/ui/` - User interface components

## 🔧 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/amazing-feature
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clean, readable code
- Add comments for complex logic
- Update documentation if needed
- Test your changes thoroughly

### 3. Test Locally

```bash
# Run the agent
npm start

# Test with various scenarios
? Task: [your test task]

# Check for errors
npm run dev  # Watch mode for quick iteration
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature: Brief description

- Detailed point 1
- Detailed point 2
- Related issue: #123"
```

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```
feat: Add support for Claude Opus 4

- Integrate new model API
- Update provider configuration
- Add model selection in UI

Closes #45
```

```
fix: Prevent sudo timeout on long-running commands

- Increase timeout to 60s for sudo operations
- Add proper error handling
- Update terminal tool documentation

Fixes #67
```

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/amazing-feature

# Create pull request on GitHub
gh pr create --title "Add amazing feature" --body "Description of changes"
```

## 🧪 Testing Guidelines

### Manual Testing

Test your changes with various scenarios:

```bash
# Start Apollo
npm start

# Test cases
? Task: List all files in src/
? Task: Install a package
? Task: Refactor a function
? Task: Search for a symbol
```

### Test Checklist

- [ ] Feature works as intended
- [ ] No errors in console
- [ ] Handles edge cases
- [ ] Works with different inputs
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)

## 📚 Documentation

### Update Documentation When:

- Adding new features
- Changing existing behavior
- Adding new configuration options
- Fixing bugs that affect usage

### Documentation Files:

- `README.md` - Main documentation
- `FEATURES.md` - Feature documentation
- Code comments - Inline documentation
- `CONTRIBUTING.md` - This file

## 🐛 Bug Reports

### Good Bug Report Includes:

1. **Clear Title** - Brief description of the issue
2. **Environment** - OS, Node version, npm version
3. **Steps to Reproduce** - Exact steps to trigger the bug
4. **Expected Behavior** - What should happen
5. **Actual Behavior** - What actually happens
6. **Logs** - Error messages, stack traces
7. **Screenshots** - If applicable

### Example:

```markdown
**Bug:** Sudo commands timeout on Arch Linux

**Environment:**
- OS: Arch Linux
- Node: v20.10.0
- Apollo: v1.0.0

**Steps to Reproduce:**
1. Start Apollo
2. Run task: "Install nginx"
3. Enter sudo password
4. Wait

**Expected:** Command completes successfully
**Actual:** Timeout after 30 seconds

**Error:**
```
Error: Command timed out
  at TerminalTool.execute (terminal-tool.js:45)
```
```

## 💡 Feature Requests

### Good Feature Request Includes:

1. **Clear Description** - What feature do you want?
2. **Use Case** - Why is it needed?
3. **Proposed Solution** - How might it work?
4. **Alternatives** - Other approaches considered?

### Example:

```markdown
**Feature:** Support for Azure OpenAI

**Use Case:** 
Many organizations use Azure OpenAI for compliance reasons. Adding support 
would allow Apollo to be used in enterprise environments.

**Proposed Solution:**
- Add AzureOpenAIProvider class in src/providers/
- Support Azure endpoints in configuration
- Add authentication via API key

**Alternatives:**
- Proxy through OpenRouter (limited compatibility)
- Manual API calls (loses Apollo integration)
```

## 🔍 Code Review Process

### What We Look For:

- **Functionality** - Does it work as intended?
- **Code Quality** - Is it clean and maintainable?
- **Documentation** - Is it documented?
- **Testing** - Has it been tested?
- **Compatibility** - Does it break anything?

### Response Time:

- We aim to review PRs within 3-5 days
- Complex changes may take longer
- We'll provide feedback or request changes

## 🎨 UI/UX Guidelines

Apollo uses a rich CLI interface with:

- **Colors** - Use chalk for consistent coloring
- **Spinners** - Use ora for loading states
- **Tables** - Use cli-table3 for structured data
- **Boxes** - Use boxen for important messages

### Examples:

```javascript
// Good: Consistent with existing UI
this.ui.success('Operation completed!');
this.ui.error('Something went wrong');
this.ui.warning('This might take a while');

// Spinner for async operations
this.ui.startSpinner('Processing...');
// ... do work ...
this.ui.stopSpinner(true, 'Done!');
```

## 🔐 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email security concerns to the maintainer
2. Include detailed description
3. Provide steps to reproduce
4. Allow time for patching before disclosure

### Security Best Practices:

- Never commit API keys or passwords
- Use environment variables for secrets
- Validate all user input
- Handle errors securely
- Review dependencies for vulnerabilities

## 📄 License

By contributing to Apollo Agent, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

- **Issues** - [GitHub Issues](https://github.com/AlexandrosLiaskos/apollo-agent/issues)
- **Discussions** - [GitHub Discussions](https://github.com/AlexandrosLiaskos/apollo-agent/discussions)

---

Thank you for contributing to Apollo Agent! 🚀
