const crypto = require('crypto');
const GitHubAccount = require('../models/githubAccountModel');
const GitHubRepo = require('../models/githubRepoModel');
const OAuthState = require('../models/oauthStateModel');
const GitHubService = require('../services/githubService');
const { DomainAnalysisService } = require('../services/domainAnalysisService');
const { encryptToken, decryptToken } = require('../utils/cryptoUtils');

module.exports = {
  /**
   * GET /api/github/connect
   * Generates a single-use OAuth state and returns authorization URL
   */
  connect: async (req, res) => {
    try {
      const userId = req.user.id;

      // Generate secure 32-byte random hex state
      const state = crypto.randomBytes(32).toString('hex');

      // Store in DB with 10-minute expiry
      await OAuthState.create({
        state,
        userId,
        isUsed: false,
      });

      const authUrl = GitHubService.getOAuthUrl(state);

      if (req.query.redirect === 'true') {
        return res.redirect(authUrl);
      }

      return res.status(200).json({
        success: true,
        authUrl,
        state,
      });
    } catch (error) {
      console.error('Error initiating GitHub connection:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initiate GitHub OAuth connection',
      });
    }
  },

  /**
   * GET /api/github/callback
   * Public callback endpoint called by GitHub OAuth redirect
   */
  callback: async (req, res) => {
    const { code, state, error, error_description } = req.query;

    const frontendUrl = process.env.FRONTEND_URL || 'https://github.com/Supratim158/preply';
    const deepLinkSuccess = 'preply://github/callback?status=success';
    const deepLinkBaseError = 'preply://github/callback?status=error';

    // Helper to send deep link redirect with HTML fallback for external browser
    const renderRedirect = (deepLinkUrl, statusText, isError = false) => {
      const title = isError ? 'Connection Failed' : 'GitHub Connected!';
      const accentColor = isError ? '#EF4444' : '#10B981';
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - Preply</title>
            <style>
              body {
                background: #0F172A;
                color: #F8FAFC;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
                text-align: center;
              }
              .card {
                background: rgba(30, 41, 59, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                padding: 32px 24px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
              }
              .icon {
                font-size: 48px;
                margin-bottom: 16px;
              }
              h2 {
                color: ${accentColor};
                margin-top: 0;
                font-size: 22px;
              }
              p {
                color: #94A3B8;
                font-size: 15px;
                line-height: 1.5;
                margin-bottom: 24px;
              }
              .btn {
                display: inline-block;
                background: #8B5CF6;
                color: #FFFFFF;
                text-decoration: none;
                font-weight: 600;
                padding: 12px 24px;
                border-radius: 12px;
                transition: background 0.2s;
              }
              .btn:hover {
                background: #7C3AED;
              }
            </style>
            <script>
              // Attempt to trigger deep link automatically
              window.onload = function() {
                setTimeout(function() {
                  window.location.href = "${deepLinkUrl}";
                }, 300);
              };
            </script>
          </head>
          <body>
            <div class="card">
              <div class="icon">${isError ? '⚠️' : '🎉'}</div>
              <h2>${title}</h2>
              <p>${statusText}</p>
              <a href="${deepLinkUrl}" class="btn">Return to Preply App</a>
            </div>
          </body>
        </html>
      `);
    };

    // Handle OAuth authorization denied or cancelled by user
    if (error) {
      console.warn('GitHub OAuth authorization error:', error, error_description);
      return renderRedirect(
        `${deepLinkBaseError}&message=${encodeURIComponent(error_description || error)}`,
        error_description || 'GitHub authorization was declined.',
        true
      );
    }

    if (!code || !state) {
      return renderRedirect(
        `${deepLinkBaseError}&message=missing_parameters`,
        'Missing code or state in OAuth callback.',
        true
      );
    }

    try {
      // Validate OAuth state
      const stateRecord = await OAuthState.findOne({ state, isUsed: false });

      if (!stateRecord) {
        return renderRedirect(
          `${deepLinkBaseError}&message=invalid_or_expired_state`,
          'Invalid or expired connection session. Please try connecting again from Preply.',
          true
        );
      }

      // Invalidate state immediately (single-use)
      stateRecord.isUsed = true;
      await stateRecord.save();

      const initiatingUserId = stateRecord.userId;

      // Exchange code for GitHub access token
      const tokenData = await GitHubService.exchangeCodeForToken(code);
      const rawAccessToken = tokenData.access_token;

      if (!rawAccessToken) {
        return renderRedirect(
          `${deepLinkBaseError}&message=token_exchange_failed`,
          'Failed to obtain access token from GitHub.',
          true
        );
      }

      // Fetch GitHub user profile
      const ghUser = await GitHubService.fetchUserProfile(rawAccessToken);
      const githubIdStr = String(ghUser.id);

      // Verify this GitHub account is not already linked to another Preply account
      const existingAccount = await GitHubAccount.findOne({
        githubId: githubIdStr,
        userId: { $ne: initiatingUserId },
      });

      if (existingAccount) {
        return renderRedirect(
          `${deepLinkBaseError}&message=already_linked_to_another_user`,
          'This GitHub account is already linked to another Preply user.',
          true
        );
      }

      // Encrypt access token using AES-256-GCM
      const encryptedToken = encryptToken(rawAccessToken);

      // Scopes list
      const scopes = (tokenData.scope || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Upsert GitHubAccount for the initiating Preply user
      let account = await GitHubAccount.findOne({ userId: initiatingUserId });

      if (account) {
        account.githubId = githubIdStr;
        account.username = ghUser.login;
        account.profileUrl = ghUser.html_url || `https://github.com/${ghUser.login}`;
        account.avatarUrl = ghUser.avatar_url || '';
        account.accessToken = encryptedToken;
        account.scopes = scopes;
        account.status = 'connected';
        account.connectedAt = new Date();
        await account.save();
      } else {
        account = await GitHubAccount.create({
          userId: initiatingUserId,
          githubId: githubIdStr,
          username: ghUser.login,
          profileUrl: ghUser.html_url || `https://github.com/${ghUser.login}`,
          avatarUrl: ghUser.avatar_url || '',
          accessToken: encryptedToken,
          scopes,
          status: 'connected',
          connectedAt: new Date(),
        });
      }

      // Background repository synchronization so user doesn't wait
      // The user can also trigger manual sync
      GitHubService.fetchAllRepositories(rawAccessToken)
        .then(async (repos) => {
          if (Array.isArray(repos) && repos.length > 0) {
            const bulkOps = repos.map((repo) => ({
              updateOne: {
                filter: { userId: initiatingUserId, repoId: repo.repoId },
                update: { $set: { ...repo, userId: initiatingUserId } },
                upsert: true,
              },
            }));
            await GitHubRepo.bulkWrite(bulkOps);

            // Clean up any stale repos
            const currentRepoIds = repos.map((r) => r.repoId);
            await GitHubRepo.deleteMany({
              userId: initiatingUserId,
              repoId: { $nin: currentRepoIds },
            });

            // Run domain analysis
            const allCurrentRepos = await GitHubRepo.find({ userId: initiatingUserId });
            const analysis = DomainAnalysisService.analyze(allCurrentRepos);

            account.lastSyncedAt = new Date();
            account.insights = analysis;
            await account.save();
          }
        })
        .catch((err) => {
          console.warn('Background repo sync notice:', err.message);
        });

      return renderRedirect(
        deepLinkSuccess,
        'Successfully connected your GitHub account! Returning to Preply...'
      );
    } catch (error) {
      console.error('GitHub callback handling error:', error.message);
      return renderRedirect(
        `${deepLinkBaseError}&message=${encodeURIComponent(error.message)}`,
        `Connection failed: ${error.message}`,
        true
      );
    }
  },

  /**
   * GET /api/github/status
   * Verifies GitHub connection status for the authenticated user
   */
  status: async (req, res) => {
    try {
      const userId = req.user.id;

      const account = await GitHubAccount.findOne({ userId });

      if (!account || account.status !== 'connected') {
        return res.status(200).json({
          success: true,
          connected: false,
        });
      }

      const repoCount = await GitHubRepo.countDocuments({ userId });
      const nonForkCount = await GitHubRepo.countDocuments({ userId, isFork: false });

      return res.status(200).json({
        success: true,
        connected: true,
        username: account.username,
        profileUrl: account.profileUrl,
        avatarUrl: account.avatarUrl,
        scopes: account.scopes,
        connectedAt: account.connectedAt,
        lastSyncedAt: account.lastSyncedAt,
        repositoryCount: repoCount,
        analyzedRepositories: nonForkCount,
        hasInsights:
          !!account.insights &&
          account.insights.recommendedDomain &&
          account.insights.recommendedDomain !== 'Insufficient Data',
      });
    } catch (error) {
      console.error('Error fetching GitHub status:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve GitHub connection status',
      });
    }
  },

  /**
   * GET /api/github/repos
   * Retrieves cached repositories for the authenticated user
   */
  repos: async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const includeForks = req.query.includeForks === 'true';

      const filter = { userId };
      if (!includeForks) {
        filter.isFork = false;
      }

      const total = await GitHubRepo.countDocuments(filter);
      const repos = await GitHubRepo.find(filter)
        .sort({ updatedAtRepo: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-userId -__v');

      return res.status(200).json({
        success: true,
        total,
        page,
        limit,
        repositories: repos,
      });
    } catch (error) {
      console.error('Error retrieving repositories:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch repositories',
      });
    }
  },

  /**
   * POST /api/github/sync
   * Synchronizes repositories from GitHub REST API and updates domain analysis
   */
  sync: async (req, res) => {
    try {
      const userId = req.user.id;

      const account = await GitHubAccount.findOne({ userId });
      if (!account || account.status !== 'connected') {
        return res.status(400).json({
          success: false,
          message: 'GitHub account is not connected. Please connect first.',
        });
      }

      // Decrypt token
      let decryptedToken;
      try {
        decryptedToken = decryptToken(account.accessToken);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: 'Failed to decrypt GitHub access token. Please reconnect.',
        });
      }

      // Fetch all repositories from GitHub API
      const repos = await GitHubService.fetchAllRepositories(decryptedToken);

      if (repos.length > 0) {
        const bulkOps = repos.map((repo) => ({
          updateOne: {
            filter: { userId, repoId: repo.repoId },
            update: { $set: { ...repo, userId } },
            upsert: true,
          },
        }));
        await GitHubRepo.bulkWrite(bulkOps);

        // Delete repos that are no longer accessible/deleted on GitHub
        const currentRepoIds = repos.map((r) => r.repoId);
        await GitHubRepo.deleteMany({
          userId,
          repoId: { $nin: currentRepoIds },
        });
      } else {
        await GitHubRepo.deleteMany({ userId });
      }

      // Re-run deterministic domain analysis
      const allRepos = await GitHubRepo.find({ userId });
      const insights = DomainAnalysisService.analyze(allRepos);

      account.lastSyncedAt = new Date();
      account.insights = insights;
      await account.save();

      return res.status(200).json({
        success: true,
        message: 'Repositories synchronized and career insights updated successfully',
        totalSynced: repos.length,
        insights,
      });
    } catch (error) {
      console.error('Repository synchronization failed:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to synchronize repositories from GitHub',
      });
    }
  },

  /**
   * POST /api/github/analyze
   * Runs or re-runs deterministic domain analysis on cached repositories
   */
  analyze: async (req, res) => {
    try {
      const userId = req.user.id;

      const account = await GitHubAccount.findOne({ userId });
      if (!account || account.status !== 'connected') {
        return res.status(400).json({
          success: false,
          message: 'GitHub account is not connected. Please connect from Edit Profile.',
        });
      }

      const repos = await GitHubRepo.find({ userId });
      const insights = DomainAnalysisService.analyze(repos);

      account.insights = insights;
      await account.save();

      return res.status(200).json({
        success: true,
        ...insights,
      });
    } catch (error) {
      console.error('Domain analysis failed:', error.message);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to perform domain analysis',
      });
    }
  },

  /**
   * GET /api/github/insights
   * Returns career domain insights for the Preply user
   */
  insights: async (req, res) => {
    try {
      const userId = req.user.id;

      const account = await GitHubAccount.findOne({ userId });
      if (!account || account.status !== 'connected') {
        return res.status(200).json({
          success: false,
          connected: false,
          message: 'Connect your GitHub account from Edit Profile to discover your strongest technical domain.',
        });
      }

      // If insights already exist, return them
      if (
        account.insights &&
        account.insights.recommendedDomain &&
        account.insights.recommendedDomain !== 'Insufficient Data'
      ) {
        return res.status(200).json({
          success: true,
          connected: true,
          recommendedDomain: account.insights.recommendedDomain,
          confidence: account.insights.confidence,
          totalRepositories: account.insights.totalRepositories,
          analyzedRepositories: account.insights.analyzedRepositories,
          domainBreakdown: account.insights.domainBreakdown,
          reason: account.insights.reason,
          lastAnalyzedAt: account.insights.lastAnalyzedAt,
        });
      }

      // If not yet computed or empty, compute from cached repos
      const repos = await GitHubRepo.find({ userId });
      const insights = DomainAnalysisService.analyze(repos);

      account.insights = insights;
      await account.save();

      return res.status(200).json({
        success: true,
        connected: true,
        recommendedDomain: insights.recommendedDomain,
        confidence: insights.confidence,
        totalRepositories: insights.totalRepositories,
        analyzedRepositories: insights.analyzedRepositories,
        domainBreakdown: insights.domainBreakdown,
        reason: insights.reason,
        lastAnalyzedAt: insights.lastAnalyzedAt,
      });
    } catch (error) {
      console.error('Error fetching career insights:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve career insights',
      });
    }
  },

  /**
   * DELETE /api/github/disconnect
   * Disconnects GitHub account and deletes all cached credentials and repositories
   */
  disconnect: async (req, res) => {
    try {
      const userId = req.user.id;

      // Delete cached repositories
      await GitHubRepo.deleteMany({ userId });

      // Delete account record and stored token
      await GitHubAccount.findOneAndDelete({ userId });

      return res.status(200).json({
        success: true,
        message: 'GitHub account disconnected and cached repositories removed successfully',
      });
    } catch (error) {
      console.error('Failed to disconnect GitHub account:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to disconnect GitHub account',
      });
    }
  },
};
