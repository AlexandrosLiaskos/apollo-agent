/**
 * OpenRouter Provider
 * https://openrouter.ai/docs/quick-start
 *
 * Uses OpenAI-compatible API with OpenRouter endpoint
 */

export class OpenRouterProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
    this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1';
    this.model = options.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
    this.siteUrl = options.siteUrl || process.env.OPENROUTER_SITE_URL || '';
    this.siteName = options.siteName || process.env.OPENROUTER_SITE_NAME || 'Apollo Agent';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;

    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required. Set it in .env or pass in options.');
    }
  }

  /**
   * Sleep helper for retry delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  async fetchWithRetry(url, options, retries = this.maxRetries) {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error;
        const isRetryable = error.name === 'AbortError' ||
                           error.message.includes('fetch failed') ||
                           error.message.includes('ECONNRESET') ||
                           error.message.includes('ETIMEDOUT');

        if (attempt < retries && isRetryable) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`Fetch attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
        } else {
          throw new Error(`Network error after ${attempt} attempts: ${error.message}`);
        }
      }
    }

    throw lastError;
  }

  /**
   * Send a chat completion request
   */
  async chat(messages, options = {}) {
    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
      },
      body: JSON.stringify({
        model: options.model || this.model,
        messages,
        tools: options.tools,
        tool_choice: options.toolChoice,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: options.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Send a chat request with tool calling support
   */
  async chatWithTools(messages, tools, options = {}) {
    const formattedTools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || tool.parameters || { type: 'object', properties: {} }
      }
    }));

    return await this.chat(messages, {
      ...options,
      tools: formattedTools,
      toolChoice: options.toolChoice || 'auto',
    });
  }

  /**
   * Process a response that may contain tool calls
   */
  extractToolCalls(response) {
    const message = response.choices?.[0]?.message;
    if (!message) return { content: null, toolCalls: [] };

    return {
      content: message.content,
      toolCalls: message.tool_calls || [],
      finishReason: response.choices?.[0]?.finish_reason,
    };
  }

  /**
   * Format tool results for the next request
   */
  formatToolResults(toolCalls, results) {
    return toolCalls.map((call, idx) => ({
      role: 'tool',
      tool_call_id: call.id,
      content: typeof results[idx] === 'string' ? results[idx] : JSON.stringify(results[idx]),
    }));
  }

  /**
   * Run a full agent loop with tool execution
   */
  async runAgentLoop(messages, tools, executeToolFn, options = {}) {
    const maxIterations = options.maxIterations || 10;
    let iteration = 0;
    let currentMessages = [...messages];

    // Helper function to decode HTML entities
    const decodeHTMLEntities = (text) => {
      const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
      };
      return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
    };

    while (iteration < maxIterations) {
      iteration++;

      const response = await this.chatWithTools(currentMessages, tools, options);
      const { content, toolCalls, finishReason } = this.extractToolCalls(response);

      // If no tool calls, we're done
      if (!toolCalls.length || finishReason === 'stop') {
        return { content, messages: currentMessages, iterations: iteration };
      }

      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      // Execute tools and add results
      const toolResults = await Promise.all(
        toolCalls.map(async (call) => {
          // Decode HTML entities before parsing JSON
          const decodedArgs = decodeHTMLEntities(call.function.arguments);
          const args = JSON.parse(decodedArgs);
          return await executeToolFn(call.function.name, args);
        })
      );

      currentMessages.push(...this.formatToolResults(toolCalls, toolResults));
    }

    throw new Error(`Agent loop exceeded ${maxIterations} iterations`);
  }

  /**
   * List available models from OpenRouter
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Change the default model
   */
  setModel(model) {
    this.model = model;
  }
}

