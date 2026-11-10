const FILLER_PATTERNS = [
  /\buh\b/gi,
  /\bum+\b/gi,
  /\bumm+\b/gi,
  /\bhmm+\b/gi,
  /\bah+\b/gi,
  /\ber+\b/gi,
  /\beh+\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bbasically\b/gi,
  /\blike\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi
];

const detectFillers = (text) => {
  const found = [];

  for (const pattern of FILLER_PATTERNS) {
    const matches = text.match(pattern) || [];

    for (const match of matches) {
      found.push(match.toLowerCase());
    }
  }

  return found;
};

const analyzePauses = (words = []) => {
  const pauses = [];

  for (let i = 1; i < words.length; i++) {
    const previous = words[i - 1];
    const current = words[i];

    const gap = Number(current.start) - Number(previous.end);

    // Count pauses longer than 0.8 seconds.
    if (gap >= 0.8 && gap <= 30) {
      pauses.push({
        start: Number(previous.end),
        end: Number(current.start),
        durationSeconds: Number(gap.toFixed(2))
      });
    }
  }

  const totalPauseSeconds = pauses.reduce(
    (sum, pause) => sum + pause.durationSeconds,
    0
  );

  const longestPauseSeconds = pauses.length
    ? Math.max(...pauses.map((p) => p.durationSeconds))
    : 0;

  return {
    pauseCount: pauses.length,
    totalPauseSeconds: Number(totalPauseSeconds.toFixed(2)),
    longestPauseSeconds: Number(longestPauseSeconds.toFixed(2)),
    pauses
  };
};

const analyzeSpeech = (transcription) => {
  const text = String(transcription.text || "").trim();

  const words = transcription.words || [];
  const segments = transcription.segments || [];

  const wordCount = text
    ? text.split(/\s+/).filter(Boolean).length
    : 0;

  const duration = Math.max(
    0,
    Number(transcription.duration || 0)
  );

  const fillers = detectFillers(text);

  // Prefer word timestamps; use segment timestamps if word
  // timestamps are unavailable.
  const timingWords = words.length
    ? words
    : segments.map((segment) => ({
        start: segment.start,
        end: segment.end
      }));

  const pauseMetrics = analyzePauses(timingWords);

  const speakingDurationSeconds = Math.max(
    0,
    duration - pauseMetrics.totalPauseSeconds
  );

  const speakingRateWpm = speakingDurationSeconds > 0
    ? Math.round(
        wordCount / (speakingDurationSeconds / 60)
      )
    : 0;

  return {
    transcript: text,
    wordCount,
    audioDurationSeconds: Number(duration.toFixed(2)),

    speakingDurationSeconds: Number(
      speakingDurationSeconds.toFixed(2)
    ),

    speakingRateWpm,

    fillerWordCount: fillers.length,
    fillerWords: fillers,

    pauseCount: pauseMetrics.pauseCount,
    totalPauseSeconds: pauseMetrics.totalPauseSeconds,
    longestPauseSeconds: pauseMetrics.longestPauseSeconds,
    pauses: pauseMetrics.pauses,

    segments
  };
};

module.exports = {
  analyzeSpeech,
  detectFillers,
  analyzePauses
};