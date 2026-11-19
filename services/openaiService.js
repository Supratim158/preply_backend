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
 * Call OpenAI Responses API with structured JSON output
 */
const generateStructuredJson = async ({
  instructions,
  input,
  reasoningEffort = null,
  maxOutputTokens = 3500,
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
        parsedData = JSON.parse(response.output_text);
      } catch (jsonErr) {
        // Attempt to extract JSON if surrounded by markdown code blocks
        const match = response.output_text.match(/```json\s*([\s\S]*?)\s*```/) ||
          response.output_text.match(/\{[\s\S]*\}/);
        if (match) {
          parsedData = JSON.parse(match[1] || match[0]);
        } else {
          throw new Error(`Failed to parse AI output as JSON: ${jsonErr.message}`);
        }
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

      // If rate limited or transient network error, wait and retry
      const isRateLimitOrTransient =
        err.status === 429 ||
        err.status >= 500 ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNRESET";

      if (attempt < retries && isRateLimitOrTransient) {
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
  maxOutputTokens = 2000,
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
  generateStructuredJson,
  generateText,
  extractTokenUsage,
};
