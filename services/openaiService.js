const OpenAI = require("openai");

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    try {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (err) {
      console.error("Failed to initialize OpenAI client:", err.message);
      openaiClient = null;
    }
  }
  return openaiClient;
};

const getModel = () => process.env.OPENAI_MODEL || "gpt-6-luna";

/**
 * Extract token usage from OpenAI Responses API result
 */
const extractTokenUsage = (response) => {
  const usage = response?.usage || {};
  const inputTokens =
    usage.input_tokens ||
    usage.prompt_tokens ||
    usage.input_token_details?.total ||
    0;
  const outputTokens =
    usage.output_tokens ||
    usage.completion_tokens ||
    usage.output_token_details?.total ||
    0;
  const totalTokens = usage.total_tokens || inputTokens + outputTokens;

  return {
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
    totalTokens: Number(totalTokens) || 0,
  };
};

/**
 * Robust JSON parser and auto-repair utility
 * Handles:
 * - Markdown code fences
 * - Trailing commas before } or ]
 * - Truncated JSON strings/arrays/objects resulting from token limit cutoff
 * - Unescaped control characters
 */
const repairAndParseJson = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  let text = rawText.trim();

  // Strip markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else {
    const firstBrace = text.indexOf("{");
    if (firstBrace !== -1) {
      text = text.slice(firstBrace);
    }
  }

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(text);
  } catch (err1) {
    // Continue to repair attempts
  }

  // Attempt 2: Remove trailing commas
  let cleaned = text.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch (err2) {
    // Continue to structural repair
  }

  // Attempt 3: Structural repair for truncated JSON
  let inString = false;
  let isEscaped = false;
  const stack = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (char === "\\" && !isEscaped) {
        isEscaped = true;
      } else if (char === '"' && !isEscaped) {
        inString = false;
      } else {
        isEscaped = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
        }
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
        }
      }
    }
  }

  let repaired = cleaned;

  // If truncated inside a string, close the quote
  if (inString) {
    repaired += '"';
  }

  // Remove trailing dangling commas or partial key-values
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  repaired = repaired.replace(/,\s*"[^"]*"\s*$/, "");

  // Close remaining open brackets and braces in reverse order
  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === "{") {
      repaired += "}";
    } else if (openChar === "[") {
      repaired += "]";
    }
  }

  // Clean trailing commas again before closing brackets
  repaired = repaired.replace(/,\s*([\]}])/g, "$1");

  return JSON.parse(repaired);
};

/**
 * Call OpenAI Responses API with structured JSON output
 */
const generateStructuredJson = async ({
  instructions,
  input,
  reasoningEffort = null,
  maxOutputTokens = 4500,
  retries = 2,
}) => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API client is not initialized. Please set OPENAI_API_KEY.");
  }

  const model = getModel();

  let promptInput =
    typeof input === "object" && input !== null
      ? JSON.stringify(input, null, 2)
      : String(input || "");

  if (!promptInput.toLowerCase().includes("json")) {
    promptInput = `Please evaluate the following input and return your response in JSON format:\n\n${promptInput}`;
  }

  const payload = {
    model,
    instructions,
    input: promptInput,
    text: {
      format: {
        type: "json_object",
      },
    },
    max_output_tokens: maxOutputTokens,
  };

  if (reasoningEffort) {
    payload.reasoning = { effort: reasoningEffort };
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.responses.create(payload);

      if (!response.output_text) {
        throw new Error("AI returned an empty response.");
      }

      let parsedData;
      try {
        parsedData = repairAndParseJson(response.output_text);
      } catch (parseErr) {
        console.warn(`[OpenAI JSON Parse Warning] Attempt ${attempt + 1}: ${parseErr.message}`);
        throw new Error(`Invalid JSON returned by AI: ${parseErr.message}`);
      }

      const usage = extractTokenUsage(response);

      return {
        data: parsedData,
        rawText: response.output_text,
        usage,
      };
    } catch (err) {
      lastError = err;

      // If reasoning parameter caused an error, retry without it immediately
      if (payload.reasoning && err.message && (err.message.includes("reasoning") || err.message.includes("parameter"))) {
        delete payload.reasoning;
        continue;
      }

      // If token limit caused truncation, increase max_output_tokens on next attempt
      if (err.message && (err.message.includes("JSON") || err.message.includes("tokens"))) {
        payload.max_output_tokens = Math.min(8000, (payload.max_output_tokens || 4000) + 1500);
      }

      // If rate limited or transient network error, wait and retry
      const isTransient =
        err.status === 429 ||
        err.status >= 500 ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNRESET" ||
        (err.message && err.message.includes("JSON"));

      if (attempt < retries && isTransient) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI call transient error (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`, err.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  console.error("OpenAI API call failed after retries:", lastError?.message);
  throw lastError;
};

/**
 * Call OpenAI Responses API with plain text output
 */
const generateText = async ({
  instructions,
  input,
  reasoningEffort = null,
  maxOutputTokens = 3000,
  retries = 2,
}) => {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OpenAI API client is not initialized. Please set OPENAI_API_KEY.");
  }

  const model = getModel();

  const payload = {
    model,
    instructions,
    input: typeof input === "object" ? JSON.stringify(input, null, 2) : String(input || ""),
    max_output_tokens: maxOutputTokens,
  };

  if (reasoningEffort) {
    payload.reasoning = { effort: reasoningEffort };
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.responses.create(payload);

      if (!response.output_text) {
        throw new Error("AI returned an empty response.");
      }

      const usage = extractTokenUsage(response);

      return {
        text: response.output_text,
        usage,
      };
    } catch (err) {
      lastError = err;

      if (payload.reasoning && err.message && (err.message.includes("reasoning") || err.message.includes("parameter"))) {
        delete payload.reasoning;
        continue;
      }

      const isRateLimitOrTransient =
        err.status === 429 ||
        err.status >= 500 ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNRESET";

      if (attempt < retries && isRateLimitOrTransient) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  console.error("OpenAI text call failed:", lastError?.message);
  throw lastError;
};

module.exports = {
  getOpenAIClient,
  getModel,
  repairAndParseJson,
  generateStructuredJson,
  generateText,
  extractTokenUsage,
};
