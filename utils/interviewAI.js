const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MODEL =
  process.env.OPENAI_INTERVIEW_MODEL || "gpt-6-luna";

const QUESTION_CATEGORIES = {
  1: "Behavioral / HR",
  2: "Technical",
  3: "Problem Solving",
  4: "Technical",
  5: "Communication",
  6: "Technical",
  7: "Problem Solving",
  8: "Behavioral / HR",
  9: "Technical",
  10: "Behavioral / HR"
};

const clamp = (value) => {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  return Math.max(0, Math.min(100, Math.round(n)));
};

const callAI = async (instructions, input) => {
  let promptInput =
    typeof input === "object" && input !== null
      ? JSON.stringify(input, null, 2)
      : String(input || "");

  if (!promptInput.toLowerCase().includes("json")) {
    promptInput = `Please evaluate the following input and return your response in JSON format:\n\n${promptInput}`;
  }

  const response = await openai.responses.create({
    model: MODEL,
    instructions,
    input: promptInput,
    text: {
      format: {
        type: "json_object"
      }
    }
  });

  if (!response.output_text) {
    throw new Error("AI returned an empty response.");
  }

  return {
    result: JSON.parse(response.output_text),
    usage: response.usage || {}
  };
};

const getFirstQuestion = () => ({
  question: "Tell me about yourself.",
  category: "Behavioral / HR",
  difficulty: "easy",
  expectedKeywords: [
    "background",
    "education",
    "skills",
    "projects",
    "experience"
  ],
  timeLimitSeconds: 30
});

const getFinalQuestion = () => ({
  question: "Why should we hire you?",
  category: "Behavioral / HR",
  difficulty: "medium",
  expectedKeywords: [
    "skills",
    "strengths",
    "projects",
    "contribution",
    "role"
  ],
  timeLimitSeconds: 45
});

const createCombinedEvaluation = async ({
  interview,
  question,
  answer,
  speechMetrics,
  previousContext,
  isLastQuestion,
  timedOut
}) => {
  const expectedCategory =
    QUESTION_CATEGORIES[question.questionNumber];

  const input = {
    targetRole: interview.targetRole,
    experienceLevel: interview.experienceLevel,
    jobDescription: interview.jobDescription,

    resumeContext: interview.resumeContext,
    previousAnswerContext: previousContext,

    questionNumber: question.questionNumber,
    currentQuestion: question.question,
    expectedCategory,
    expectedKeywords: question.expectedKeywords,

    candidateAnswer: answer,
    speechMetrics,
    timedOut,
    isLastQuestion
  };

  const instructions = `
You are a professional technical interviewer and communication coach.

Evaluate the candidate's interview answer for the given role.

EXPERIENCE LEVEL:
- freshie: entry level
- intermediate: moderate experience
- senior: experienced professional

EVALUATE:
1. Technical correctness and knowledge.
2. Relevance to the question.
3. Logical and structured problem solving.
4. Communication and clarity.
5. Grammar.
6. Practical examples.
7. Unnecessary filler words and hesitation.

SPEECH METRICS:
You will receive measured filler counts, pause counts and speaking rate.

Use these metrics when evaluating communication:
- Repeated unnecessary "um", "uh", "hmm" and similar fillers can reduce communication score.
- Excessive long pauses can indicate difficulty maintaining flow.
- A pause is not automatically a mistake. Candidates need time to think.
- Do not penalize a candidate heavily for one or two fillers.
- Consider the length of the answer and its context.
- Do not treat the word "like" as a filler when it is used correctly.
- Do not claim to know the candidate's vocal confidence or pronunciation from text and timestamps alone.
- Confidence is an estimate of clarity and answer structure, not a voice-emotion measurement.

IMPORTANT:
- Do not reward keywords that are merely mentioned without explanation.
- Do not invent facts.
- Give constructive, specific feedback.
- Score all numerical dimensions between 0 and 100.
- If timedOut is true, explain that the answer was incomplete.
- Use the supplied category for the current question.

QUESTION GENERATION:
- Generate one question only.
- Never repeat previous questions.
- Adapt the next question to the candidate's answer and weak areas.
- Match difficulty to experience level.
- Follow the next question category provided by the backend.
- Recommend a time between 15 and 45 seconds.
- Basic questions: 15-20 seconds.
- Normal concept questions: 25-30 seconds.
- Detailed technical questions: 35-40 seconds.
- Complex scenarios: 40-45 seconds.

Return valid JSON only.

For questions 1-9:

{
  "evaluation": {
    "score": 0,
    "technicalKnowledge": 0,
    "communication": 0,
    "problemSolving": 0,
    "behavioral": 0,
    "confidence": 0,
    "relevance": 0,
    "grammar": 0,
    "feedback": "...",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."],
    "missingPoints": ["..."],
    "importantKeywordsHeard": ["..."],
    "fillerFeedback": "...",
    "pauseFeedback": "..."
  },
  "nextQuestion": {
    "question": "...",
    "difficulty": "medium",
    "expectedKeywords": ["..."],
    "timeLimitSeconds": 30
  }
}

For question 10:

{
  "evaluation": {
    "score": 0,
    "technicalKnowledge": 0,
    "communication": 0,
    "problemSolving": 0,
    "behavioral": 0,
    "confidence": 0,
    "relevance": 0,
    "grammar": 0,
    "feedback": "...",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."],
    "missingPoints": ["..."],
    "importantKeywordsHeard": ["..."],
    "fillerFeedback": "...",
    "pauseFeedback": "..."
  },
  "finalReport": {
    "summary": "...",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."]
  }
}
`;

  const { result, usage } = await callAI(
    instructions,
    `Evaluate the candidate's interview answer and return your response in JSON format based on the following input data:\n\n${JSON.stringify(input, null, 2)}`
  );

  const raw = result.evaluation || {};

  const evaluation = {
    score: clamp(raw.score),
    technicalKnowledge: clamp(raw.technicalKnowledge),
    communication: clamp(raw.communication),
    problemSolving: clamp(raw.problemSolving),
    behavioral: clamp(raw.behavioral),
    confidence: clamp(raw.confidence),
    relevance: clamp(raw.relevance),
    grammar: clamp(raw.grammar),

    feedback: String(raw.feedback || ""),

    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.slice(0, 5)
      : [],

    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses.slice(0, 5)
      : [],

    suggestions: Array.isArray(raw.suggestions)
      ? raw.suggestions.slice(0, 5)
      : [],

    missingPoints: Array.isArray(raw.missingPoints)
      ? raw.missingPoints.slice(0, 10)
      : [],

    importantKeywordsHeard: Array.isArray(
      raw.importantKeywordsHeard
    )
      ? raw.importantKeywordsHeard.slice(0, 15)
      : [],

    fillerFeedback: String(raw.fillerFeedback || ""),
    pauseFeedback: String(raw.pauseFeedback || "")
  };

  if (isLastQuestion) {
    const report = result.finalReport || {};

    return {
      evaluation,
      finalReport: {
        summary: String(report.summary || ""),
        strengths: Array.isArray(report.strengths)
          ? report.strengths.slice(0, 8)
          : [],
        weaknesses: Array.isArray(report.weaknesses)
          ? report.weaknesses.slice(0, 8)
          : [],
        suggestions: Array.isArray(report.suggestions)
          ? report.suggestions.slice(0, 8)
          : []
      },
      usage
    };
  }

  const next = result.nextQuestion || {};

  const nextQuestion = {
    question: String(next.question || "").trim(),
    category: QUESTION_CATEGORIES[question.questionNumber + 1],
    difficulty: ["easy", "medium", "hard"].includes(next.difficulty)
      ? next.difficulty
      : "medium",

    expectedKeywords: Array.isArray(next.expectedKeywords)
      ? next.expectedKeywords.slice(0, 12)
      : [],

    timeLimitSeconds: Math.max(
      15,
      Math.min(45, Math.round(Number(next.timeLimitSeconds) || 30))
    )
  };

  if (!nextQuestion.question) {
    throw new Error("AI failed to generate the next question.");
  }

  return {
    evaluation,
    nextQuestion,
    usage
  };
};

module.exports = {
  createCombinedEvaluation,
  getFirstQuestion,
  getFinalQuestion,
  QUESTION_CATEGORIES
};