const OpenAI = require("openai");

let openaiClient = null;
const getOpenAIClient = () => {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    try {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (err) {
      console.warn("Failed to initialize OpenAI:", err.message);
      openaiClient = null;
    }
  }
  return openaiClient;
};

const getModel = () =>
  process.env.OPENAI_INTERVIEW_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-6-luna";

/**
 * Normalizes role names into canonical job titles.
 * e.g., "flutter" -> "Flutter Developer", "full stack" -> "Full Stack Developer"
 */
const getCanonicalRole = (rawRole) => {
  if (!rawRole || typeof rawRole !== "string") return "General";
  const lower = rawRole.toLowerCase().trim();

  if (lower.includes("flutter")) return "Flutter Developer";
  if (lower.includes("full stack") || lower.includes("fullstack"))
    return "Full Stack Developer";
  if (
    lower.includes("frontend") ||
    lower.includes("front end") ||
    lower.includes("front-end")
  )
    return "Frontend Developer";
  if (
    lower.includes("backend") ||
    lower.includes("back end") ||
    lower.includes("back-end")
  )
    return "Backend Developer";
  if (lower.includes("android")) return "Android Developer";
  if (lower.includes("ios")) return "iOS Developer";
  if (lower.includes("devops")) return "DevOps Engineer";
  if (lower.includes("ui/ux") || lower.includes("uiux"))
    return "UI/UX Designer";
  if (lower.includes("data science") || lower.includes("data scientist"))
    return "Data Scientist";
  if (lower.includes("qa") || lower.includes("tester"))
    return "QA Engineer";

  // Default: capitalize each word
  return rawRole
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Calculates interview stats across roles and time progression.
 */
const calculateInterviewStats = (interviews = []) => {
  if (!Array.isArray(interviews) || interviews.length === 0) {
    return {
      hasInterviews: false,
      totalCompletedInterviews: 0,
      roleStats: [],
      overallAverageScore: 0,
      overallFirstScore: 0,
      overallLatestScore: 0,
      overallPercentageChange: 0,
      allStrengths: [],
      allWeaknesses: []
    };
  }

  // Group by canonical role
  const groups = {};

  interviews.forEach((item) => {
    const role = getCanonicalRole(item.targetRole);
    if (!groups[role]) {
      groups[role] = [];
    }
    groups[role].push(item);
  });

  const roleStats = Object.keys(groups).map((role) => {
    const list = groups[role];
    const count = list.length;
    const scores = list.map(
      (iv) => Math.round(Number(iv.finalReport?.overallScore) || 0)
    );

    const firstScore = scores[0] || 0;
    const latestScore = scores[scores.length - 1] || 0;
    const bestScore = Math.max(...scores);
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const averageScore = Math.round(sum / count);

    let percentageChange = 0;
    let status = "baseline";

    if (count > 1) {
      if (firstScore > 0) {
        percentageChange = Number(
          (((latestScore - firstScore) / firstScore) * 100).toFixed(1)
        );
      } else if (latestScore > 0) {
        percentageChange = 100.0;
      }

      if (percentageChange > 0) {
        status = "improved";
      } else if (percentageChange < 0) {
        status = "declined";
      } else {
        status = "steady";
      }
    }

    // Skills progression
    const firstSkills = list[0].finalReport?.skillWisePerformance || {};
    const latestSkills =
      list[list.length - 1].finalReport?.skillWisePerformance || {};

    const skillProgress = {
      technical: {
        initial: firstSkills.technical || 0,
        latest: latestSkills.technical || 0,
        change: (latestSkills.technical || 0) - (firstSkills.technical || 0)
      },
      communication: {
        initial: firstSkills.communication || 0,
        latest: latestSkills.communication || 0,
        change:
          (latestSkills.communication || 0) -
          (firstSkills.communication || 0)
      },
      problemSolving: {
        initial: firstSkills.problemSolving || 0,
        latest: latestSkills.problemSolving || 0,
        change:
          (latestSkills.problemSolving || 0) -
          (firstSkills.problemSolving || 0)
      },
      behavioral: {
        initial: firstSkills.behavioral || 0,
        latest: latestSkills.behavioral || 0,
        change:
          (latestSkills.behavioral || 0) -
          (firstSkills.behavioral || 0)
      },
      confidence: {
        initial: firstSkills.confidence || 0,
        latest: latestSkills.confidence || 0,
        change:
          (latestSkills.confidence || 0) - (firstSkills.confidence || 0)
      }
    };

    // Collect strengths & weaknesses
    const strengths = [];
    const weaknesses = [];

    list.forEach((iv) => {
      if (Array.isArray(iv.finalReport?.strengths)) {
        strengths.push(...iv.finalReport.strengths);
      }
      if (Array.isArray(iv.finalReport?.weaknesses)) {
        weaknesses.push(...iv.finalReport.weaknesses);
      }
    });

    return {
      role,
      count,
      firstScore,
      latestScore,
      bestScore,
      averageScore,
      percentageChange,
      status,
      skillProgress,
      recentStrengths: [...new Set(strengths)].slice(0, 5),
      recentWeaknesses: [...new Set(weaknesses)].slice(0, 5)
    };
  });

  const totalCompletedInterviews = interviews.length;
  const overallFirstScore =
    Math.round(Number(interviews[0]?.finalReport?.overallScore) || 0);
  const overallLatestScore =
    Math.round(
      Number(
        interviews[interviews.length - 1]?.finalReport?.overallScore
      ) || 0
    );

  const totalScoreSum = interviews.reduce(
    (sum, iv) => sum + (Number(iv.finalReport?.overallScore) || 0),
    0
  );
  const overallAverageScore = Math.round(
    totalScoreSum / totalCompletedInterviews
  );

  let overallPercentageChange = 0;
  if (totalCompletedInterviews > 1) {
    if (overallFirstScore > 0) {
      overallPercentageChange = Number(
        (
          ((overallLatestScore - overallFirstScore) / overallFirstScore) *
          100
        ).toFixed(1)
      );
    } else if (overallLatestScore > 0) {
      overallPercentageChange = 100.0;
    }
  }

  const allStrengths = [
    ...new Set(roleStats.flatMap((r) => r.recentStrengths))
  ].slice(0, 6);
  const allWeaknesses = [
    ...new Set(roleStats.flatMap((r) => r.recentWeaknesses))
  ].slice(0, 6);

  return {
    hasInterviews: true,
    totalCompletedInterviews,
    roleStats,
    overallAverageScore,
    overallFirstScore,
    overallLatestScore,
    overallPercentageChange,
    allStrengths,
    allWeaknesses
  };
};

/**
 * Deterministic fallback builder in case AI call fails or is unavailable.
 * Accurately constructs the prompt-compliant insight string:
 * "You have given 2 Flutter Developer interviews and 3 Full Stack Developer interviews. Your Flutter Developer interview increased by 15% and Full Stack Developer increased by 25%."
 */
const buildDeterministicInsight = (stats) => {
  if (!stats.hasInterviews || stats.totalCompletedInterviews === 0) {
    return {
      insight:
        "You haven't completed any mock interviews yet. Start your first practice interview to track your score progression and get personalized AI career insights!",
      summary:
        "Take mock interviews across your desired roles to evaluate technical expertise, communication, and confidence.",
      roleBreakdown: [],
      keyStrengths: [
        "Proactive career preparation",
        "Eager to improve interview readiness"
      ],
      focusAreas: [
        "Complete your first mock interview",
        "Practice speaking within time limits"
      ],
      recommendations: [
        "Upload a tailored resume before starting",
        "Choose your target role (e.g. Flutter Developer or Full Stack Developer)",
        "Review your speech pace and pause patterns after answering"
      ]
    };
  }

  // Interview count summary e.g. "2 Flutter Developer interviews and 3 Full Stack Developer interviews"
  const countsSummary = stats.roleStats
    .map(
      (r) =>
        `${r.count} ${r.role} interview${r.count > 1 ? "s" : ""}`
    )
    .join(stats.roleStats.length === 2 ? " and " : ", ");

  // Percentage change clauses
  const changeClauses = stats.roleStats.map((r) => {
    if (r.count === 1) {
      return `your ${r.role} baseline is set at ${r.latestScore}/100`;
    }
    if (r.percentageChange > 0) {
      return `your ${r.role} interview increased by ${r.percentageChange}%`;
    }
    if (r.percentageChange < 0) {
      return `your ${r.role} interview changed by ${r.percentageChange}%`;
    }
    return `your ${r.role} interview remained steady at ${r.latestScore}/100`;
  });

  const changesSummary =
    changeClauses.length === 1
      ? changeClauses[0]
      : changeClauses.length === 2
      ? `${changeClauses[0]} and ${changeClauses[1]}`
      : `${changeClauses.slice(0, -1).join(", ")}, and ${changeClauses[changeClauses.length - 1]}`;

  // Capitalize first letter of clause
  const capitalizedChanges =
    changesSummary.charAt(0).toUpperCase() + changesSummary.slice(1);

  const headlineInsight = `You have given ${countsSummary}. ${capitalizedChanges}.`;

  const roleBreakdown = stats.roleStats.map((r) => {
    let feedback = "";
    if (r.count === 1) {
      feedback = `Initial baseline scored at ${r.latestScore}/100. Complete another interview in this role to measure percentage growth.`;
    } else if (r.percentageChange > 0) {
      feedback = `Performance grew from ${r.firstScore} to ${r.latestScore} (+${r.percentageChange}%), showing noticeable improvement across responses.`;
    } else if (r.percentageChange < 0) {
      feedback = `Score moved from ${r.firstScore} to ${r.latestScore} (${r.percentageChange}%). Focus on structure and core concepts to regain peak form.`;
    } else {
      feedback = `Consistently maintained a solid score of ${r.latestScore}/100.`;
    }

    return {
      role: r.role,
      count: r.count,
      firstScore: r.firstScore,
      latestScore: r.latestScore,
      bestScore: r.bestScore,
      averageScore: r.averageScore,
      percentageChange: r.percentageChange,
      status: r.status,
      feedback
    };
  });

  return {
    insight: headlineInsight,
    summary: `Across ${stats.totalCompletedInterviews} total completed interview session${stats.totalCompletedInterviews > 1 ? "s" : ""}, your overall average score is ${stats.overallAverageScore}/100 with an overall trajectory change of ${stats.overallPercentageChange > 0 ? "+" : ""}${stats.overallPercentageChange}%. Keep up this targeted practice to master role-specific questions.`,
    roleBreakdown,
    keyStrengths:
      stats.allStrengths.length > 0
        ? stats.allStrengths
        : [
            "Consistent practice cadence",
            "Clear technical explanations",
            "Structured response delivery"
          ],
    focusAreas:
      stats.allWeaknesses.length > 0
        ? stats.allWeaknesses
        : [
            "Elaborate on real-world architecture decisions",
            "Minimize hesitation fillers during technical deep-dives"
          ],
    recommendations: [
      "Continue practicing consecutive interviews to maintain upward score momentum.",
      "Review the missing points and suggestions from your latest interview reports.",
      "Target challenging scenario-based questions to further elevate your problem-solving scores."
    ]
  };
};

/**
 * Calls OpenAI to generate an insightful career summary,
 * falling back gracefully to deterministic analysis if OpenAI is unreachable.
 */
const generateInterviewAIInsight = async (stats) => {
  if (!stats.hasInterviews || stats.totalCompletedInterviews === 0) {
    return buildDeterministicInsight(stats);
  }

  const roleDataText = stats.roleStats
    .map(
      (r) =>
        `- ${r.role}: ${r.count} interview(s) completed. First score: ${r.firstScore}/100, Latest score: ${r.latestScore}/100, Best score: ${r.bestScore}/100, Score change: ${r.percentageChange > 0 ? "+" : ""}${r.percentageChange}%, Status: ${r.status}.`
    )
    .join("\n");

  const promptInput = `
Candidate Interview History:
- Total Completed Interviews: ${stats.totalCompletedInterviews}
- Overall Average Score: ${stats.overallAverageScore}/100
- Overall Progression: ${stats.overallPercentageChange > 0 ? "+" : ""}${stats.overallPercentageChange}%

Breakdown by Role:
${roleDataText}

Observed Strengths from previous interviews:
${stats.allStrengths.map((s) => `* ${s}`).join("\n") || "Consistent practice"}

Observed Areas for Improvement:
${stats.allWeaknesses.map((w) => `* ${w}`).join("\n") || "Keep refining response structure"}
`;

  const instructions = `
You are Preply's Senior AI Career & Interview Coach.
Analyze the candidate's interview track record and generate an intelligent, motivating, and highly personalized AI Career Insight.

CRITICAL INSTRUCTIONS FOR "insight" FIELD:
- The "insight" field MUST be a clear, punchy 1-2 sentence statement.
- It MUST explicitly state the count of interviews completed for each role (e.g. "You have given 2 Flutter Developer interviews and 3 Full Stack Developer interviews.")
- It MUST explicitly state the percentage increase or change for each role (e.g. "Your Flutter Developer interview score increased by 15.4% and your Full Stack Developer score increased by 25.0%!")
- If a role has only 1 interview, state that its baseline has been set at that score.

RETURN VALID JSON ONLY matching this exact schema:
{
  "insight": "You have given 2 Flutter Developer interviews and 3 Full Stack Developer interviews. Your Flutter Developer score increased by 15.4% and Full Stack Developer increased by 25.0%!",
  "summary": "Detailed narrative summarizing their journey, progression across roles, and overall momentum...",
  "roleBreakdown": [
    {
      "role": "Flutter Developer",
      "count": 2,
      "firstScore": 65,
      "latestScore": 75,
      "bestScore": 75,
      "averageScore": 70,
      "percentageChange": 15.4,
      "status": "improved",
      "feedback": "Role-specific feedback and growth highlights..."
    }
  ],
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "focusAreas": ["Focus area 1", "Focus area 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}
`;

  try {
    let result = null;
    const client = getOpenAIClient();
    const model = getModel();

    if (client && typeof client.responses?.create === "function") {
      const response = await client.responses.create({
        model: model,
        instructions,
        input: promptInput,
        text: {
          format: {
            type: "json_object"
          }
        }
      });

      if (response && response.output_text) {
        result = JSON.parse(response.output_text);
      }
    } else if (
      client &&
      typeof client.chat?.completions?.create === "function"
    ) {
      const response = await client.chat.completions.create({
        model: model || "gpt-4o-mini",
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: promptInput }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        result = JSON.parse(content);
      }
    }

    if (!result || !result.insight) {
      return buildDeterministicInsight(stats);
    }

    // Merge computed numerical truths with AI qualitative text to prevent AI hallucinations
    const mergedBreakdown = stats.roleStats.map((statItem) => {
      const aiRoleMatch = Array.isArray(result.roleBreakdown)
        ? result.roleBreakdown.find(
            (r) =>
              r &&
              r.role &&
              r.role.toLowerCase() === statItem.role.toLowerCase()
          )
        : null;

      return {
        role: statItem.role,
        count: statItem.count,
        firstScore: statItem.firstScore,
        latestScore: statItem.latestScore,
        bestScore: statItem.bestScore,
        averageScore: statItem.averageScore,
        percentageChange: statItem.percentageChange,
        status: statItem.status,
        feedback:
          aiRoleMatch?.feedback ||
          `Scored ${statItem.latestScore}/100 with ${
            statItem.percentageChange >= 0 ? "+" : ""
          }${statItem.percentageChange}% change across ${statItem.count} session(s).`
      };
    });

    return {
      insight: String(result.insight).trim(),
      summary:
        String(result.summary || "").trim() ||
        buildDeterministicInsight(stats).summary,
      roleBreakdown: mergedBreakdown,
      keyStrengths: Array.isArray(result.keyStrengths)
        ? result.keyStrengths.slice(0, 5)
        : stats.allStrengths,
      focusAreas: Array.isArray(result.focusAreas)
        ? result.focusAreas.slice(0, 5)
        : stats.allWeaknesses,
      recommendations: Array.isArray(result.recommendations)
        ? result.recommendations.slice(0, 5)
        : buildDeterministicInsight(stats).recommendations
    };
  } catch (err) {
    console.warn(
      "OpenAI insight generation failed, using deterministic fallback:",
      err.message
    );
    return buildDeterministicInsight(stats);
  }
};

/**
 * Automatically recalculates and updates the saved AI Career Insight for a user
 * after every new completed interview.
 */
const refreshUserInterviewInsight = async (userId, latestInterviewId = null) => {
  const Interview = require("../models/interviewModel");
  const InterviewInsight = require("../models/interviewInsightModel");

  // Fetch all completed interviews for this user sorted chronologically
  const completedInterviews = await Interview.find({
    userId,
    status: "completed"
  })
    .select("targetRole experienceLevel finalReport createdAt completedAt")
    .sort({ createdAt: 1 })
    .lean();

  const stats = calculateInterviewStats(completedInterviews);
  const aiResult = await generateInterviewAIInsight(stats);

  const payload = {
    userId,
    hasInterviews: stats.hasInterviews,
    totalInterviews: stats.totalCompletedInterviews,
    overallAverageScore: stats.overallAverageScore,
    overallPercentageChange: stats.overallPercentageChange,
    insight: aiResult.insight,
    summary: aiResult.summary,
    roleBreakdown: aiResult.roleBreakdown,
    keyStrengths: aiResult.keyStrengths,
    focusAreas: aiResult.focusAreas,
    recommendations: aiResult.recommendations,
    lastInterviewId:
      latestInterviewId ||
      (completedInterviews.length > 0
        ? completedInterviews[completedInterviews.length - 1]._id
        : null),
    lastCalculatedAt: new Date()
  };

  const saved = await InterviewInsight.findOneAndUpdate(
    { userId },
    { $set: payload },
    { upsert: true, returnDocument: "after" }
  );

  return saved;
};

module.exports = {
  getCanonicalRole,
  calculateInterviewStats,
  buildDeterministicInsight,
  generateInterviewAIInsight,
  refreshUserInterviewInsight
};
