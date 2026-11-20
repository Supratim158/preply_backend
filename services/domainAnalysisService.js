/**
 * Deterministic, rule-based career domain analysis service.
 * NO AI APIs, LLMs, or external AI services.
 */

const DOMAINS = {
  FLUTTER: 'Flutter Development',
  FRONTEND: 'Frontend Development',
  BACKEND: 'Backend Development',
  FULLSTACK: 'Full Stack Development',
  ANDROID: 'Android Development',
  IOS: 'iOS Development',
  AIML: 'AI/Machine Learning',
  DATA_SCIENCE: 'Data Science',
  DEVOPS: 'DevOps/Cloud Computing',
  CYBERSECURITY: 'Cybersecurity',
  WEB3: 'Web3/Blockchain',
  GAMEDEV: 'Game Development',
};

// Domain-specific topics and framework tags (lowercased)
const DOMAIN_TOPICS = {
  [DOMAINS.FLUTTER]: [
    'flutter', 'dart', 'flutter-apps', 'flutter-app', 'riverpod', 'bloc',
    'provider', 'getx', 'flutter-web', 'flutter-ui', 'flutter-package'
  ],
  [DOMAINS.FRONTEND]: [
    'react', 'reactjs', 'vue', 'vuejs', 'angular', 'svelte', 'html', 'html5',
    'css', 'css3', 'scss', 'sass', 'tailwind', 'tailwindcss', 'bootstrap',
    'redux', 'vite', 'webpack', 'frontend', 'front-end', 'ui-kit', 'styled-components'
  ],
  [DOMAINS.BACKEND]: [
    'nodejs', 'node', 'express', 'expressjs', 'nestjs', 'fastify', 'koa',
    'django', 'flask', 'fastapi', 'spring', 'spring-boot', 'aspnet', 'dotnet',
    'laravel', 'rubyonrails', 'rails', 'gin', 'fiber', 'postgresql', 'postgres',
    'mongodb', 'mysql', 'redis', 'graphql', 'rest-api', 'backend', 'back-end',
    'microservices', 'prisma', 'typeorm', 'sqlalchemy', 'hibernate'
  ],
  [DOMAINS.FULLSTACK]: [
    'fullstack', 'full-stack', 'mern', 'mern-stack', 'mean', 'mean-stack',
    'mevn', 'lamp-stack', 'nextjs', 'nuxtjs', 'sveltekit', 'remix', 't3-stack',
    'trpc', 'supabase', 'firebase'
  ],
  [DOMAINS.ANDROID]: [
    'android', 'android-app', 'jetpack-compose', 'android-sdk', 'kotlin-android',
    'android-architecture-components', 'dagger-hilt', 'room-database', 'retrofit'
  ],
  [DOMAINS.IOS]: [
    'ios', 'swift', 'swiftui', 'uikit', 'xcode', 'cocoapods', 'combine',
    'ios-app', 'coredata', 'objective-c', 'watchos'
  ],
  [DOMAINS.AIML]: [
    'machine-learning', 'deep-learning', 'artificial-intelligence', 'ai', 'ml',
    'neural-network', 'pytorch', 'tensorflow', 'keras', 'opencv', 'huggingface',
    'llm', 'transformers', 'nlp', 'computer-vision', 'reinforcement-learning'
  ],
  [DOMAINS.DATA_SCIENCE]: [
    'data-science', 'data-analysis', 'data-visualization', 'pandas', 'numpy',
    'jupyter', 'jupyter-notebook', 'matplotlib', 'seaborn', 'scipy', 'scikit-learn',
    'pyspark', 'big-data', 'etl', 'data-engineering', 'data-mining', 'polars'
  ],
  [DOMAINS.DEVOPS]: [
    'devops', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'helm',
    'ci-cd', 'github-actions', 'jenkins', 'aws', 'azure', 'gcp', 'cloud',
    'prometheus', 'grafana', 'nginx', 'linux', 'infrastructure-as-code'
  ],
  [DOMAINS.CYBERSECURITY]: [
    'cybersecurity', 'security', 'penetration-testing', 'pen-testing', 'ethical-hacking',
    'ctf', 'ctfs', 'malware-analysis', 'cryptography', 'vulnerability-scanner',
    'reverse-engineering', 'burpsuite', 'wireshark', 'infosec', 'zero-day'
  ],
  [DOMAINS.WEB3]: [
    'blockchain', 'web3', 'ethereum', 'smart-contracts', 'solidity', 'defi',
    'nft', 'dapp', 'hardhat', 'truffle', 'ethersjs', 'web3js', 'solana', 'polygon'
  ],
  [DOMAINS.GAMEDEV]: [
    'game-development', 'gamedev', 'unity', 'unity3d', 'unreal-engine', 'godot',
    'pygame', 'opengl', 'vulkan', '2d-game', '3d-game', 'shader', 'directx', 'sfml'
  ],
};

// Domain description keyword patterns (word boundaries for exact match)
const DOMAIN_KEYWORDS = {
  [DOMAINS.FLUTTER]: [/\bflutter\b/i, /\bdart\b/i, /\briverpod\b/i, /\bgetx\b/i, /\bbloc\b/i],
  [DOMAINS.FRONTEND]: [/\breact(\.js)?\b/i, /\bvue(\.js)?\b/i, /\bangular\b/i, /\bsvelte\b/i, /\btailwind\b/i, /\bfrontend\b/i, /\bfront-end\b/i, /\bcss3?\b/i, /\bhtml5?\b/i, /\buser interface\b/i],
  [DOMAINS.BACKEND]: [/\bnode(\.js)?\b/i, /\bexpress(\.js)?\b/i, /\bnest(\.js)?\b/i, /\bdjango\b/i, /\bflask\b/i, /\bfastapi\b/i, /\bspring boot\b/i, /\bbackend\b/i, /\bback-end\b/i, /\brest(ful)? api\b/i, /\bmicroservices?\b/i, /\bgraphql\b/i, /\bdatabase\b/i],
  [DOMAINS.FULLSTACK]: [/\bfull[\s-]?stack\b/i, /\bmern\b/i, /\bmean\b/i, /\bnext(\.js)?\b/i, /\bnuxt(\.js)?\b/i, /\bsveltekit\b/i],
  [DOMAINS.ANDROID]: [/\bandroid\b/i, /\bjetpack compose\b/i, /\bandroid studio\b/i, /\bapk\b/i],
  [DOMAINS.IOS]: [/\bios\b/i, /\bswiftui\b/i, /\buikit\b/i, /\bxcode\b/i, /\bapple\b/i, /\biphone\b/i],
  [DOMAINS.AIML]: [/\bmachine learning\b/i, /\bdeep learning\b/i, /\bartificial intelligence\b/i, /\bneural networks?\b/i, /\bpytorch\b/i, /\btensorflow\b/i, /\bkeras\b/i, /\bcomputer vision\b/i, /\bnlp\b/i, /\bllms?\b/i, /\btransformers?\b/i],
  [DOMAINS.DATA_SCIENCE]: [/\bdata science\b/i, /\bdata analysis\b/i, /\bdata analytics\b/i, /\bpandas\b/i, /\bnumpy\b/i, /\bjupyter\b/i, /\bdata visualization\b/i, /\bbig data\b/i, /\betl\b/i],
  [DOMAINS.DEVOPS]: [/\bdevops\b/i, /\bdocker\b/i, /\bkubernetes\b/i, /\bterraform\b/i, /\bci[\/-]cd\b/i, /\baws\b/i, /\bcloud\b/i, /\bgcp\b/i, /\bazure\b/i, /\binfrastructure\b/i],
  [DOMAINS.CYBERSECURITY]: [/\bcybersecurity\b/i, /\bsecurity\b/i, /\bpenetration testing\b/i, /\bethical hacking\b/i, /\bctf\b/i, /\bvulnerability\b/i, /\bcryptography\b/i, /\bmalware\b/i],
  [DOMAINS.WEB3]: [/\bweb3\b/i, /\bblockchain\b/i, /\bsmart contract\b/i, /\bethereum\b/i, /\bsolidity\b/i, /\bdapp\b/i, /\bdefi\b/i, /\bnft\b/i],
  [DOMAINS.GAMEDEV]: [/\bgame dev(elopment)?\b/i, /\bunity(3d)?\b/i, /\bunreal engine\b/i, /\bgodot\b/i, /\bpygame\b/i, /\bgameplay\b/i],
};

class DomainAnalysisService {
  /**
   * Analyzes an array of cached repository documents
   * @param {Array} repositories List of GitHubRepo documents
   * @returns {Object} Deterministic domain analysis result
   */
  static analyze(repositories) {
    const totalRepositories = repositories.length;

    // Rule: Exclude forked repositories from default domain analysis
    const validRepos = repositories.filter((repo) => !repo.isFork);
    const analyzedRepositories = validRepos.length;

    if (analyzedRepositories === 0) {
      return {
        success: true,
        recommendedDomain: 'Insufficient Data',
        confidence: 'none',
        totalRepositories,
        analyzedRepositories: 0,
        domainBreakdown: [],
        reason: 'No original (non-forked) repositories found to analyze.',
        lastAnalyzedAt: new Date(),
      };
    }

    // Domain points accumulator
    const domainScores = {};
    const domainRepoCounts = {};

    Object.values(DOMAINS).forEach((d) => {
      domainScores[d] = 0;
      domainRepoCounts[d] = 0;
    });

    let totalPointsAwardedAcrossAllDomains = 0;

    for (const repo of validRepos) {
      const repoPoints = {};
      Object.values(DOMAINS).forEach((d) => {
        repoPoints[d] = 0;
      });

      // Context strings
      const desc = (repo.description || '').toLowerCase();
      const topics = (repo.topics || []).map((t) => t.toLowerCase());
      const allText = `${repo.name.toLowerCase()} ${desc} ${topics.join(' ')}`;

      // 1. Language Distribution (60% weight -> max 60 points per repo)
      const langMap = repo.languages instanceof Map
        ? Object.fromEntries(repo.languages)
        : (repo.languages || {});

      let totalBytes = 0;
      for (const b of Object.values(langMap)) {
        totalBytes += Number(b) || 0;
      }

      if (totalBytes > 0) {
        for (const [langName, bytes] of Object.entries(langMap)) {
          const proportion = (Number(bytes) || 0) / totalBytes;
          const langPoints = proportion * 60; // 60% max weight

          DomainAnalysisService._distributeLanguagePoints(
            langName,
            langPoints,
            repoPoints,
            allText,
            topics
          );
        }
      } else if (repo.primaryLanguage) {
        // Fallback when byte breakdown is 0 but primaryLanguage is known
        DomainAnalysisService._distributeLanguagePoints(
          repo.primaryLanguage,
          35,
          repoPoints,
          allText,
          topics
        );
      }

      // 2. Repository Topics & Frameworks (25% weight -> max 25 points per repo)
      for (const [domain, tagList] of Object.entries(DOMAIN_TOPICS)) {
        let topicMatches = 0;
        for (const tag of tagList) {
          if (topics.includes(tag)) {
            topicMatches++;
          }
        }
        if (topicMatches > 0) {
          // Cap topic points at 25 per repo per domain
          const pts = Math.min(25, topicMatches * 10);
          repoPoints[domain] = (repoPoints[domain] || 0) + pts;
        }
      }

      // 3. Repository Description & Metadata (15% weight -> max 15 points per repo)
      if (desc.trim().length > 0) {
        for (const [domain, regexList] of Object.entries(DOMAIN_KEYWORDS)) {
          let kwMatches = 0;
          for (const rx of regexList) {
            if (rx.test(desc)) {
              kwMatches++;
            }
          }
          if (kwMatches > 0) {
            const pts = Math.min(15, kwMatches * 6);
            repoPoints[domain] = (repoPoints[domain] || 0) + pts;
          }
        }
      }

      // Contextual Full Stack Check:
      // If repo has significant Frontend (>= 15) AND Backend (>= 15), boost Full Stack
      if (
        repoPoints[DOMAINS.FRONTEND] >= 15 &&
        repoPoints[DOMAINS.BACKEND] >= 15
      ) {
        repoPoints[DOMAINS.FULLSTACK] += 20;
      }

      // Recency multiplier (secondary signal, max 10% boost for recent active repos)
      let recencyMultiplier = 1.0;
      const lastUpdated = repo.pushedAtRepo || repo.updatedAtRepo;
      if (lastUpdated) {
        const diffMonths = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (diffMonths <= 6) {
          recencyMultiplier = 1.1;
        } else if (diffMonths <= 12) {
          recencyMultiplier = 1.05;
        }
      }

      // Accumulate into overall totals
      let repoContributedToAny = false;
      for (const [domain, pts] of Object.entries(repoPoints)) {
        if (pts > 0) {
          const adjustedPts = pts * recencyMultiplier;
          domainScores[domain] += adjustedPts;
          domainRepoCounts[domain] += 1;
          totalPointsAwardedAcrossAllDomains += adjustedPts;
          repoContributedToAny = true;
        }
      }
    }

    // Check for insufficient data
    if (totalPointsAwardedAcrossAllDomains <= 0) {
      return {
        success: true,
        recommendedDomain: 'Insufficient Data',
        confidence: 'none',
        totalRepositories,
        analyzedRepositories,
        domainBreakdown: [],
        reason: 'Your repositories lack sufficient programming language or metadata signals to classify a career domain.',
        lastAnalyzedAt: new Date(),
      };
    }

    // Normalize domain scores into integer percentages summing to ~100%
    const breakdown = [];
    for (const [domain, rawScore] of Object.entries(domainScores)) {
      if (rawScore > 0) {
        const percentage = Math.round((rawScore / totalPointsAwardedAcrossAllDomains) * 100);
        if (percentage > 0) {
          breakdown.push({
            domain,
            score: percentage,
            repositoryCount: domainRepoCounts[domain],
          });
        }
      }
    }

    // Sort descending by score, then repositoryCount
    breakdown.sort((a, b) => b.score - a.score || b.repositoryCount - a.repositoryCount);

    if (breakdown.length === 0) {
      return {
        success: true,
        recommendedDomain: 'Insufficient Data',
        confidence: 'none',
        totalRepositories,
        analyzedRepositories,
        domainBreakdown: [],
        reason: 'Insufficient activity data to classify technical domain.',
        lastAnalyzedAt: new Date(),
      };
    }

    const topDomain = breakdown[0].domain;
    const topScore = breakdown[0].score;
    const topRepoCount = breakdown[0].repositoryCount;

    // Confidence determination
    let confidence = 'low';
    if (topScore >= 40 && topRepoCount >= 3) {
      confidence = 'high';
    } else if (topScore >= 25 && topRepoCount >= 2) {
      confidence = 'medium';
    }

    // Deterministic explanation template
    const reason = DomainAnalysisService._generateReasonTemplate(
      topDomain,
      topScore,
      topRepoCount,
      breakdown
    );

    return {
      success: true,
      recommendedDomain: topDomain,
      confidence,
      totalRepositories,
      analyzedRepositories,
      domainBreakdown: breakdown,
      reason,
      lastAnalyzedAt: new Date(),
    };
  }

  /**
   * Distributes language points contextually avoiding naive misclassifications
   */
  static _distributeLanguagePoints(langName, points, repoPoints, allText, topics) {
    const l = (langName || '').toLowerCase();

    switch (l) {
      case 'dart':
        repoPoints[DOMAINS.FLUTTER] += points;
        break;

      case 'javascript':
      case 'typescript': {
        // Contextual rule: Do NOT classify every JS/TS repo as Full Stack
        const isBackendSignal =
          topics.includes('nodejs') ||
          topics.includes('node') ||
          topics.includes('express') ||
          topics.includes('nestjs') ||
          topics.includes('fastify') ||
          /\b(express|node\.js|nestjs|mongodb|prisma|rest api|backend)\b/i.test(allText);

        const isFrontendSignal =
          topics.includes('react') ||
          topics.includes('vue') ||
          topics.includes('angular') ||
          topics.includes('svelte') ||
          /\b(react|vue|angular|svelte|tailwind|frontend|ui)\b/i.test(allText);

        if (isBackendSignal && isFrontendSignal) {
          repoPoints[DOMAINS.FULLSTACK] += points * 0.6;
          repoPoints[DOMAINS.FRONTEND] += points * 0.2;
          repoPoints[DOMAINS.BACKEND] += points * 0.2;
        } else if (isBackendSignal) {
          repoPoints[DOMAINS.BACKEND] += points;
        } else {
          // Default JS/TS is Frontend
          repoPoints[DOMAINS.FRONTEND] += points;
        }
        break;
      }

      case 'html':
      case 'css':
      case 'scss':
      case 'sass':
      case 'vue':
      case 'svelte':
        repoPoints[DOMAINS.FRONTEND] += points;
        break;

      case 'python': {
        // Contextual rule: Do NOT classify every Python repo as AI/ML
        const isAIMLSignal =
          topics.includes('machine-learning') ||
          topics.includes('deep-learning') ||
          topics.includes('pytorch') ||
          topics.includes('tensorflow') ||
          topics.includes('keras') ||
          topics.includes('huggingface') ||
          topics.includes('opencv') ||
          topics.includes('nlp') ||
          topics.includes('llm') ||
          /\b(machine learning|deep learning|neural network|pytorch|tensorflow|keras|computer vision|llm)\b/i.test(allText);

        const isDataScienceSignal =
          topics.includes('pandas') ||
          topics.includes('numpy') ||
          topics.includes('jupyter') ||
          topics.includes('data-science') ||
          topics.includes('data-analysis') ||
          topics.includes('matplotlib') ||
          topics.includes('seaborn') ||
          /\b(data science|data analysis|pandas|numpy|jupyter|eda|analytics)\b/i.test(allText);

        const isBackendSignal =
          topics.includes('django') ||
          topics.includes('flask') ||
          topics.includes('fastapi') ||
          /\b(django|flask|fastapi|sqlalchemy|celery|backend|rest api)\b/i.test(allText);

        if (isAIMLSignal) {
          repoPoints[DOMAINS.AIML] += points;
        } else if (isDataScienceSignal) {
          repoPoints[DOMAINS.DATA_SCIENCE] += points;
        } else if (isBackendSignal) {
          repoPoints[DOMAINS.BACKEND] += points;
        } else {
          // Generic python split evenly between Backend and Data Science
          repoPoints[DOMAINS.BACKEND] += points * 0.5;
          repoPoints[DOMAINS.DATA_SCIENCE] += points * 0.5;
        }
        break;
      }

      case 'java': {
        const isAndroid =
          topics.includes('android') ||
          /\b(android|gradle|apk|jetpack)\b/i.test(allText);

        if (isAndroid) {
          repoPoints[DOMAINS.ANDROID] += points;
        } else {
          // Spring Boot, enterprise backend
          repoPoints[DOMAINS.BACKEND] += points;
        }
        break;
      }

      case 'kotlin': {
        const isBackend =
          topics.includes('spring') ||
          topics.includes('ktor') ||
          /\b(spring|ktor|backend)\b/i.test(allText);

        if (isBackend) {
          repoPoints[DOMAINS.BACKEND] += points;
        } else {
          // Android primary
          repoPoints[DOMAINS.ANDROID] += points;
        }
        break;
      }

      case 'swift':
      case 'objective-c':
        repoPoints[DOMAINS.IOS] += points;
        break;

      case 'go':
      case 'php':
      case 'ruby':
      case 'elixir':
      case 'scala':
        repoPoints[DOMAINS.BACKEND] += points;
        break;

      case 'c#': {
        const isGame =
          topics.includes('unity') ||
          topics.includes('gamedev') ||
          /\b(unity|game)\b/i.test(allText);

        if (isGame) {
          repoPoints[DOMAINS.GAMEDEV] += points;
        } else {
          repoPoints[DOMAINS.BACKEND] += points;
        }
        break;
      }

      case 'c++':
      case 'c': {
        if (/\b(game|opengl|unreal|shader|directx)\b/i.test(allText)) {
          repoPoints[DOMAINS.GAMEDEV] += points;
        } else if (/\b(security|ctf|exploit|malware|crypto)\b/i.test(allText)) {
          repoPoints[DOMAINS.CYBERSECURITY] += points;
        } else if (/\b(ai|ml|tensorflow|pytorch|deep learning)\b/i.test(allText)) {
          repoPoints[DOMAINS.AIML] += points;
        } else {
          repoPoints[DOMAINS.BACKEND] += points * 0.5;
          repoPoints[DOMAINS.GAMEDEV] += points * 0.5;
        }
        break;
      }

      case 'rust': {
        if (/\b(solana|blockchain|web3|smart contract)\b/i.test(allText)) {
          repoPoints[DOMAINS.WEB3] += points;
        } else if (/\b(security|malware|reverse)\b/i.test(allText)) {
          repoPoints[DOMAINS.CYBERSECURITY] += points;
        } else {
          repoPoints[DOMAINS.BACKEND] += points;
        }
        break;
      }

      case 'solidity':
      case 'vyper':
      case 'move':
        repoPoints[DOMAINS.WEB3] += points;
        break;

      case 'r':
      case 'julia':
        repoPoints[DOMAINS.DATA_SCIENCE] += points;
        break;

      case 'shell':
      case 'powershell':
      case 'hcl':
      case 'dockerfile':
        if (/\b(security|exploit|penetration)\b/i.test(allText)) {
          repoPoints[DOMAINS.CYBERSECURITY] += points;
        } else {
          repoPoints[DOMAINS.DEVOPS] += points;
        }
        break;

      default:
        break;
    }
  }

  /**
   * Deterministically generates human-readable reasoning based on scores
   */
  static _generateReasonTemplate(topDomain, topScore, repoCount, breakdown) {
    const plural = repoCount === 1 ? 'repository' : 'repositories';
    const secondDomain = breakdown[1];

    let comparativeClause = '';
    if (secondDomain && secondDomain.score > 0) {
      comparativeClause = ` outpacing ${secondDomain.domain} (${secondDomain.score}% across ${secondDomain.repositoryCount} ${secondDomain.repositoryCount === 1 ? 'repo' : 'repos'})`;
    }

    switch (topDomain) {
      case DOMAINS.FLUTTER:
        return `Your repositories demonstrate strongest Flutter and Dart development activity (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.FRONTEND:
        return `Your codebase shows heavy emphasis on modern UI and Frontend frameworks (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.BACKEND:
        return `Your repositories exhibit robust server-side architecture, APIs, and Backend engineering (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.FULLSTACK:
        return `Your repositories reflect comprehensive end-to-end Full Stack capabilities spanning both frontend interfaces and server services (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.ANDROID:
        return `Your repositories showcase specialized native Android development activity with Kotlin and Java (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.IOS:
        return `Your repositories show dedicated native iOS development with Swift and Apple ecosystem tooling (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.AIML:
        return `Your repositories reflect active development in machine learning models, neural networks, and AI architectures (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.DATA_SCIENCE:
        return `Your repositories demonstrate data processing, scientific analysis, and analytics pipelines (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.DEVOPS:
        return `Your repositories highlight cloud infrastructure, containerization, and automated DevOps workflows (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.CYBERSECURITY:
        return `Your repositories focus on security testing, vulnerability research, and defensive computing (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.WEB3:
        return `Your repositories feature smart contracts, decentralized applications, and Web3 protocols (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      case DOMAINS.GAMEDEV:
        return `Your repositories exhibit game engine architectures, graphics programming, and interactive game mechanics (${topScore}% across ${repoCount} ${plural})${comparativeClause}.`;
      default:
        return `Your repositories demonstrate significant ${topDomain} activity across ${repoCount} ${plural} (${topScore}% of classified activity).`;
    }
  }
}

module.exports = {
  DOMAINS,
  DomainAnalysisService,
};
