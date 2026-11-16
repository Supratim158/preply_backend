const OpenAI = require('openai');

let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    try {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (err) {
      console.warn('Failed to initialize OpenAI client in auraService:', err.message);
      openaiClient = null;
    }
  }
  return openaiClient;
}

// Use the API model identifier already configured
const getModel = () =>
  process.env.OPENAI_MODEL ||
  process.env.OPENAI_INTERVIEW_MODEL ||
  'gpt-6-luna';

// -----------------------------------------
// 1. Detect greetings (NO AI)
// -----------------------------------------
function isGreeting(text) {
  return /^(?:hi+|hey+|hello+|hola|good morning|good evening|good afternoon)[!.\s]*$/i.test(
    text.trim()
  );
}

// -----------------------------------------
// 2. Detect "what can you do" (NO AI)
// -----------------------------------------
function isWhatCanYouDo(text) {
  const c = text.trim().toLowerCase();
  return (
    /^(?:(?:can you |could you |please\s+)?what can (?:you|u) do(?: for me)?|what all can (?:you|u) do|what do (?:you|u) do|how can (?:you|u) help(?: me)?|what are your (?:features|capabilities|skills)|what can (?:you|u) help (?:me )?with)[?.!\s]*$/i.test(
      c
    ) ||
    /^(?:what can you do|what can u do|what do u do)[?.!\s]*$/i.test(c) ||
    /\bwhat can (?:you|u) do\b/i.test(c)
  );
}

function whatCanYouDoReply() {
  return `I am AURA, your personal AI career and interview assistant in PREPLY! Here is everything I can do for you:

• 🎯 Conduct Mock Interviews: Real-time, voice-enabled mock interviews tailored to your target role and resume, with instant scoring and speech feedback.
• 📄 ATS Resume Analysis: Scan your resume, calculate ATS scores, and provide actionable tips to improve recruiter match rates.
• 💡 Technical & HR Prep: Explain programming concepts, system design architectures, and behavioral HR questions with structured answers.
• 📈 Track Performance & Insights: Measure your interview progress, identify weaknesses, and track percentage improvements across roles.
• 🚀 Career Guidance: Help you navigate your career path, prepare for upcoming interviews, and build confidence.

What should I do for you today?`;
}

// -----------------------------------------
// 3. Detect "tell me about yourself" (bot intro - NO AI)
// -----------------------------------------
function isAboutBot(text) {
  const c = text.trim().toLowerCase();
  return (
    /^(?:(?:can you |could you |please\s+)?tell me about (?:yourself|you|aura)|who are (?:you|u)|introduce yourself|what is aura|who is aura|describe yourself|about yourself)[?.!\s]*$/i.test(
      c
    ) ||
    /\btell me about (?:yourself|you|aura)\b/i.test(c)
  );
}

function aboutBotReply() {
  return `I am AURA, your dedicated AI career and interview mentor inside PREPLY.

My mission is to help you prepare, practice, and succeed in your dream tech career. I can simulate real technical and HR interviews, evaluate your answers and speech patterns, analyze your resume against ATS standards, and give you actionable feedback to continuously improve.

What should I do for you today?`;
}

// -----------------------------------------
// 4. Detect "tell me about myself" (user profile - NO AI)
// -----------------------------------------
function isAboutMe(text) {
  const c = text.trim().toLowerCase();
  return (
    /^(?:(?:can you |could you |please\s+)?tell me about (?:myself|me)|who am i|describe (?:me|my profile)|what do (?:you|u) know about me|my profile|show my profile|my details)[?.!\s]*$/i.test(
      c
    ) ||
    /\btell me about (?:myself|me)\b/i.test(c)
  );
}

function profileReply(user) {
  if (!user) {
    return "I couldn't find your profile details. Please update your PREPLY profile so I can personalize your experience.";
  }

  const parts = [];

  if (user.name) {
    parts.push(`• Name: ${user.name}`);
  }

  if (user.email) {
    parts.push(`• Email: ${user.email}`);
  }

  if (user.headline) {
    parts.push(`• Headline: ${user.headline}`);
  }

  if (user.targetRole) {
    parts.push(`• Target Role: ${user.targetRole}`);
  }

  // Handle skills (string or array)
  if (user.skills) {
    const skillsText = Array.isArray(user.skills)
      ? user.skills.join(', ')
      : typeof user.skills === 'string'
      ? user.skills
      : '';
    if (skillsText.trim()) {
      parts.push(`• Skills: ${skillsText.trim()}`);
    }
  }

  // Handle education
  if (user.education) {
    if (Array.isArray(user.education) && user.education.length > 0) {
      const eduList = user.education
        .map((e) => {
          const degree = e.degree || '';
          const field = e.fieldOfStudy ? `in ${e.fieldOfStudy}` : '';
          const inst = e.institution ? `at ${e.institution}` : '';
          const years =
            e.startYear || e.endYear
              ? `(${e.startYear || ''} - ${e.endYear || ''})`
              : '';
          return [degree, field, inst, years].filter(Boolean).join(' ');
        })
        .filter(Boolean);

      if (eduList.length > 0) {
        parts.push(`• Education:\n  - ${eduList.join('\n  - ')}`);
      }
    } else if (typeof user.education === 'string' && user.education.trim()) {
      parts.push(`• Education: ${user.education.trim()}`);
    }
  }

  // Handle experience
  if (user.experience) {
    if (Array.isArray(user.experience) && user.experience.length > 0) {
      const expList = user.experience
        .map((exp) => {
          const role = exp.role || '';
          const company = exp.company ? `at ${exp.company}` : '';
          const desc = exp.description ? `- ${exp.description}` : '';
          return [role, company, desc].filter(Boolean).join(' ');
        })
        .filter(Boolean);

      if (expList.length > 0) {
        parts.push(`• Experience:\n  - ${expList.join('\n  - ')}`);
      }
    } else if (typeof user.experience === 'string' && user.experience.trim()) {
      parts.push(`• Experience: ${user.experience.trim()}`);
    }
  }

  if (parts.length === 0) {
    return "I couldn't find any details in your PREPLY profile yet. Please complete your profile with your education, skills, and experience to get the best personalized interview preparation!";
  }

  return `Here is what I know about you from your PREPLY profile:\n\n${parts.join(
    '\n'
  )}\n\nWhat should I do for you today?`;
}

// -----------------------------------------
// 5. Detect interview question requests
// -----------------------------------------
function asksInterviewQuestions(text) {
  return (
    /\b(interview|technical|hr)\b/i.test(text) &&
    /\b(question|questions|q&a|practice|prepare|prep)\b/i.test(text)
  );
}

// -----------------------------------------
// 6. Main response generator
// -----------------------------------------
async function generateReply({ messages, user }) {
  const latest = messages[messages.length - 1].content;

  // CASE 1: Greeting (NO AI KEY USED)
  if (isGreeting(latest)) {
    return `Hi! I'm AURA, your AI career assistant inside PREPLY.

I can help you with:
• Technical interview preparation
• HR interview questions
• Resume improvement & ATS score
• Career guidance & concepts
• Mock interview practice

What would you like to work on today?`;
  }

  // CASE 2: "What can you do" (NO AI KEY USED)
  if (isWhatCanYouDo(latest)) {
    return whatCanYouDoReply();
  }

  // CASE 3: "Tell me about yourself" (AURA intro - NO AI KEY USED)
  if (isAboutBot(latest)) {
    return aboutBotReply();
  }

  // CASE 4: "Tell me about myself" (User profile - NO AI KEY USED)
  if (isAboutMe(latest)) {
    return profileReply(user);
  }

  // CASE 5: AI RESPONSE (Uses OpenAI API)
  const client = getOpenAIClient();
  const model = getModel();

  if (!client || !model) {
    throw new Error('OPENAI is not properly configured');
  }

  const interviewMode = asksInterviewQuestions(latest);

  const instructions = `
You are AURA, the AI career assistant of PREPLY.

Your responsibilities:
1. Help users prepare for job interviews.
2. Explain technical concepts.
3. Help users improve their resumes.
4. Provide career guidance.
5. Help with HR and behavioral interview preparation.

PERSONALITY:
- Friendly and professional.
- Easy to understand.
- Give structured answers.
- Avoid unnecessary lengthy explanations.
- Use examples wherever useful.

INTERVIEW QUESTION RULES:
${
  interviewMode
    ? `
The user wants interview questions.

You MUST:
1. Generate EXACTLY 10 questions.
2. Provide a correct and detailed answer for every question.
3. Customize questions according to the requested job role.
4. Include a mix of beginner, intermediate and advanced questions.
5. Include practical and scenario-based questions where relevant.
6. Number questions from 1 to 10.
7. Never generate only questions without answers.

If the role is not specified, ask the user which job role they are preparing for.
`
    : ''
}

IMPORTANT:
Do not invent personal information about the user.
Only use profile details when explicitly provided in the conversation.
`;

  let reply = '';

  if (typeof client.responses?.create === 'function') {
    const response = await client.responses.create({
      model: model,
      instructions: instructions,
      input: messages.slice(-20).map((message) => ({
        role: message.role,
        content: message.content
      })),
      max_output_tokens: interviewMode ? 3500 : 1200
    });
    reply = response.output_text?.trim();
  } else if (typeof client.chat?.completions?.create === 'function') {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: instructions },
        ...messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content
        }))
      ],
      max_tokens: interviewMode ? 3500 : 1200
    });
    reply = response.choices?.[0]?.message?.content?.trim();
  }

  if (!reply) {
    throw new Error('AI returned an empty response');
  }

  return reply;
}

module.exports = {
  isGreeting,
  isWhatCanYouDo,
  isAboutBot,
  isAboutMe,
  whatCanYouDoReply,
  aboutBotReply,
  profileReply,
  generateReply
};
