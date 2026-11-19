const { generateStructuredJson } = require("./openaiService");
const {
  getGenerateQuestionsInstructions,
  getGenerateQuestionsInput,
  getEvaluateAnswerInstructions,
  getEvaluateAnswerInput,
} = require("../prompts/interviewPrompt");

/**
 * Generate personalized interview questions for a session
 */
const initializeInterview = async (session) => {
  if (session.interview?.questions && session.interview.questions.length > 0) {
    return {
      questions: session.interview.questions,
      currentQuestion: session.interview.questions[session.interview.currentQuestionIndex || 0],
      progress: {
        current: (session.interview.currentQuestionIndex || 0) + 1,
        total: session.interview.questions.length,
        isCompleted: session.interview.completed,
      },
    };
  }

  const instructions = getGenerateQuestionsInstructions();
  const input = getGenerateQuestionsInput({
    targetRole: session.jobDetails.jobRole,
    jobDescription: session.jobDetails.jobDescription,
    analysis: session.analysis,
    resumeText: session.originalResume.extractedText || "",
  });

  const { data, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: "low",
    maxOutputTokens: 2500,
  });

  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];

  // Guarantee between 5 and 8 questions
  const formattedQuestions = rawQuestions.slice(0, 8).map((q, idx) => ({
    id: idx + 1,
    question: q.question || "Can you share more details about your relevant technical experience?",
    category: q.category || "Technical Skills",
    topic: q.topic || "Core Competency",
    reason: q.reason || "Clarify candidate experience for ATS optimization",
    isFollowUp: false,
    parentQuestionId: null,
  }));

  // Fallback if AI returned too few questions
  if (formattedQuestions.length < 3) {
    formattedQuestions.push({
      id: formattedQuestions.length + 1,
      question: `What was the most challenging technical project you built for ${session.jobDetails.jobRole}, and what were the measurable results?`,
      category: "Project Impact",
      topic: "Technical Challenges",
      reason: "Extract quantifiable metrics",
      isFollowUp: false,
      parentQuestionId: null,
    });
  }

  session.interview.questions = formattedQuestions;
  session.interview.answers = [];
  session.interview.currentQuestionIndex = 0;
  session.interview.completed = false;
  session.interview.maxQuestions = Math.min(10, formattedQuestions.length + 2);
  session.status = "interviewing";

  // Accumulate token usage
  session.tokenUsage.inputTokens += usage.inputTokens;
  session.tokenUsage.outputTokens += usage.outputTokens;
  session.tokenUsage.totalRequests += 1;

  await session.save();

  return {
    questions: formattedQuestions,
    currentQuestion: formattedQuestions[0],
    progress: {
      current: 1,
      total: formattedQuestions.length,
      isCompleted: false,
    },
  };
};

/**
 * Get current question and interview progress
 */
const getInterviewStatus = (session) => {
  const questions = session.interview?.questions || [];
  const currentIndex = session.interview?.currentQuestionIndex || 0;
  const isCompleted = Boolean(session.interview?.completed);

  const currentQuestion = !isCompleted && currentIndex < questions.length ? questions[currentIndex] : null;

  return {
    sessionId: session._id,
    currentQuestion,
    currentQuestionIndex: currentIndex,
    currentQuestionNumber: isCompleted ? questions.length : currentIndex + 1,
    totalQuestions: questions.length,
    answeredCount: (session.interview?.answers || []).length,
    isCompleted,
    status: session.status,
  };
};

/**
 * Submit an answer and either generate a follow-up or advance to next question
 */
const processAnswer = async (session, { answer, questionId }) => {
  if (session.interview?.completed) {
    return {
      isCompleted: true,
      message: "Interview is already completed",
      currentQuestion: null,
      progress: getInterviewStatus(session),
    };
  }

  const questions = session.interview?.questions || [];
  const currentIndex = session.interview?.currentQuestionIndex || 0;

  if (currentIndex >= questions.length) {
    session.interview.completed = true;
    session.status = "interview_completed";
    await session.save();
    return {
      isCompleted: true,
      currentQuestion: null,
      progress: getInterviewStatus(session),
    };
  }

  const activeQuestion = questions[currentIndex];
  const safeAnswer = String(answer || "").trim();

  // Evaluate the answer with AI
  const instructions = getEvaluateAnswerInstructions();
  const input = getEvaluateAnswerInput({
    targetRole: session.jobDetails.jobRole,
    currentQuestion: activeQuestion,
    userAnswer: safeAnswer,
    isFollowUpAlready: Boolean(activeQuestion.isFollowUp),
  });

  const { data: evaluation, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: "low",
    maxOutputTokens: 1500,
  });

  // Track token usage
  session.tokenUsage.inputTokens += usage.inputTokens;
  session.tokenUsage.outputTokens += usage.outputTokens;
  session.tokenUsage.totalRequests += 1;

  // Record answer
  session.interview.answers.push({
    questionId: activeQuestion.id,
    question: activeQuestion.question,
    answer: safeAnswer,
    answeredAt: new Date(),
    followUpGenerated: Boolean(evaluation.needsFollowUp),
    insights: evaluation.insights || {},
  });

  let followUpGenerated = false;

  // Check if we should insert a follow-up question
  const maxTotalQuestions = session.interview.maxQuestions || 10;
  if (
    evaluation.needsFollowUp &&
    evaluation.followUpQuestion &&
    !activeQuestion.isFollowUp &&
    questions.length < maxTotalQuestions
  ) {
    const followUpId = questions.length + 1;
    const followUpObj = {
      id: followUpId,
      question: evaluation.followUpQuestion,
      category: activeQuestion.category,
      topic: activeQuestion.topic,
      reason: "Follow-up to clarify metrics or technical implementation",
      isFollowUp: true,
      parentQuestionId: activeQuestion.id,
    };

    // Insert follow-up immediately after the current question
    questions.splice(currentIndex + 1, 0, followUpObj);
    session.interview.questions = questions;
    session.interview.currentQuestionIndex = currentIndex + 1;
    followUpGenerated = true;
  } else {
    // Advance to next question
    session.interview.currentQuestionIndex = currentIndex + 1;
  }

  // Check if all questions are completed
  if (session.interview.currentQuestionIndex >= session.interview.questions.length) {
    session.interview.completed = true;
    session.status = "interview_completed";
  }

  await session.save();

  const nextStatus = getInterviewStatus(session);

  return {
    questionAnswered: activeQuestion,
    followUpGenerated,
    isCompleted: session.interview.completed,
    nextQuestion: nextStatus.currentQuestion,
    progress: nextStatus,
  };
};

module.exports = {
  initializeInterview,
  getInterviewStatus,
  processAnswer,
};
