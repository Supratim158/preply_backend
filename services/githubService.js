const axios = require('axios');

class GitHubService {
  /**
   * Generates the GitHub OAuth authorization URL
   */
  static getOAuthUrl(state) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;
    if (!clientId || !callbackUrl) {
      throw new Error('GITHUB_CLIENT_ID or GITHUB_CALLBACK_URL is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user,public_repo',
      state: state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for GitHub access token
   */
  static async exchangeCodeForToken(code) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    if (!clientId || !clientSecret) {
      throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing');
    }

    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      },
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Preply-App',
        },
        timeout: 15000,
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error_description || response.data.error);
    }

    return response.data;
  }

  /**
   * Fetches user profile from GitHub API
   */
  static async fetchUserProfile(accessToken) {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Preply-App',
      },
      timeout: 10000,
    });

    return response.data;
  }

  /**
   * Fetches languages byte distribution for a repository
   */
  static async fetchRepoLanguages(owner, repo, accessToken) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/languages`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Preply-App',
          },
          timeout: 10000,
        }
      );
      return response.data || {};
    } catch (err) {
      // In case repo languages are inaccessible or rate limited
      return {};
    }
  }

  /**
   * Fetches topics for a repository if not present
   */
  static async fetchRepoTopics(owner, repo, accessToken) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/topics`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Preply-App',
          },
          timeout: 10000,
        }
      );
      return response.data?.names || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetches all accessible repositories with pagination (per_page=100)
   * Handles rate limits and deleted/inaccessible repos
   */
  static async fetchAllRepositories(accessToken) {
    const allRepos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      let response;
      try {
        response = await axios.get('https://api.github.com/user/repos', {
          params: {
            per_page: perPage,
            page,
            sort: 'updated',
            direction: 'desc',
            affiliation: 'owner,collaborator',
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Preply-App',
          },
          timeout: 20000,
        });
      } catch (error) {
        if (error.response) {
          if (error.response.status === 401) {
            throw new Error('GitHub token has expired or was revoked. Please reconnect your account.');
          }
          if (error.response.status === 403 || error.response.status === 429) {
            const resetTime = error.response.headers['x-ratelimit-reset'];
            const resetDate = resetTime ? new Date(resetTime * 1000).toLocaleTimeString() : 'soon';
            throw new Error(`GitHub API rate limit reached. Limit resets at ${resetDate}. Please try again later.`);
          }
        }
        throw error;
      }

      const repos = response.data || [];
      if (!Array.isArray(repos) || repos.length === 0) {
        break;
      }

      for (const repo of repos) {
        allRepos.push(repo);
      }

      if (repos.length < perPage) {
        break;
      }
      page++;
      // Safety limit to avoid runaway loops if account has thousands of repos
      if (page > 20) break;
    }

    // Now enrich repos with language breakdown in controlled batches (e.g. 5 at a time)
    const enrichedRepos = [];
    const batchSize = 5;

    for (let i = 0; i < allRepos.length; i += batchSize) {
      const batch = allRepos.slice(i, i + batchSize);
      const batchPromises = batch.map(async (repo) => {
        const owner = repo.owner?.login || repo.full_name?.split('/')[0];
        let languages = {};
        if (owner && repo.name) {
          languages = await GitHubService.fetchRepoLanguages(owner, repo.name, accessToken);
        }

        let topics = Array.isArray(repo.topics) && repo.topics.length > 0 ? repo.topics : [];
        if (topics.length === 0 && owner && repo.name) {
          topics = await GitHubService.fetchRepoTopics(owner, repo.name, accessToken);
        }

        return {
          repoId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          repoUrl: repo.html_url || '',
          languages,
          primaryLanguage: repo.language || null,
          topics,
          defaultBranch: repo.default_branch || 'main',
          stars: repo.stargazers_count || 0,
          forksCount: repo.forks_count || 0,
          isFork: repo.fork === true,
          isPrivate: repo.private === true,
          visibility: repo.visibility || (repo.private ? 'private' : 'public'),
          createdAtRepo: repo.created_at ? new Date(repo.created_at) : null,
          updatedAtRepo: repo.updated_at ? new Date(repo.updated_at) : null,
          pushedAtRepo: repo.pushed_at ? new Date(repo.pushed_at) : null,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      enrichedRepos.push(...batchResults);
    }

    return enrichedRepos;
  }
}

module.exports = GitHubService;
