import type {
  GitHubUser,
  GitHubRepo,
  GitHubCommit,
  GitHubLanguageStats,
  GitHubRawData,
  GitHubContributionData,
} from "@/types";

const GITHUB_API = "https://api.github.com";

/** Build auth headers from the user's GitHub access token */
function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...headers(token), ...options?.headers },
    next: { revalidate: 3600 }, // 1-hour cache in Next.js
  });

  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = res.headers.get("x-ratelimit-reset");
      throw new Error(`GitHub rate limit hit. Resets at ${reset}`);
    }
  }

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

/** Fetch all repos (handles pagination up to 300) */
async function fetchAllRepos(
  username: string,
  token: string
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (repos.length < 300) {
    const batch = await ghFetch<GitHubRepo[]>(
      `/users/${username}/repos?per_page=100&page=${page}&sort=pushed`,
      token
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return repos.filter((r) => !r.fork && !r.private);
}

/** Aggregate language bytes across repos */
async function fetchLanguages(
  repos: GitHubRepo[],
  token: string
): Promise<GitHubLanguageStats> {
  const top10 = repos.slice(0, 10);
  const results = await Promise.allSettled(
    top10.map((r) =>
      ghFetch<GitHubLanguageStats>(`/repos/${r.full_name}/languages`, token)
    )
  );

  const aggregate: GitHubLanguageStats = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [lang, bytes] of Object.entries(result.value)) {
        aggregate[lang] = (aggregate[lang] ?? 0) + bytes;
      }
    }
  }

  return aggregate;
}

/** Get recent commits across top repos to infer peak hours */
async function fetchRecentCommits(
  repos: GitHubRepo[],
  username: string,
  token: string
): Promise<GitHubCommit[]> {
  const active = repos
    .sort(
      (a, b) =>
        new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
    )
    .slice(0, 5);

  const results = await Promise.allSettled(
    active.map((r) =>
      ghFetch<GitHubCommit[]>(
        `/repos/${r.full_name}/commits?author=${username}&per_page=50`,
        token
      )
    )
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as PromiseFulfilledResult<GitHubCommit[]>).value);
}

/** Derive contribution patterns from raw commits */
function analyzeCommitTiming(commits: GitHubCommit[]): GitHubContributionData {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const c of commits) {
    const date = new Date(c.commit.author.date);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
  }

  // Top 3 hours by activity
  const peakHours = [...hourCounts]
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((e) => e.hour);

  return {
    totalCommits: commits.length,
    peakHours,
    commitsByDayOfWeek: dayCounts,
    streaks: { current: 0, longest: 0 }, // simplified
  };
}

/** Attempt to fetch README content for primary repo */
async function fetchReadme(
  repos: GitHubRepo[],
  token: string
): Promise<string | undefined> {
  const primary = repos[0];
  if (!primary) return undefined;

  try {
    const data = await ghFetch<{ content?: string }>(
      `/repos/${primary.full_name}/readme`,
      token
    );
    if (data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8").slice(0, 2000);
    }
  } catch {
    // README not found — not a blocker
  }
  return undefined;
}

/** Fetch starred repos to infer interest areas */
async function fetchStarredTopics(
  username: string,
  token: string
): Promise<string[]> {
  try {
    const starred = await ghFetch<GitHubRepo[]>(
      `/users/${username}/starred?per_page=30`,
      token
    );
    const topics = starred.flatMap((r) => r.topics ?? []);
    // Deduplicate and take top 15
    return [...new Set(topics)].slice(0, 15);
  } catch {
    return [];
  }
}

/** Main entry point: collect all raw GitHub data for a user */
export async function collectGitHubData(
  username: string,
  accessToken: string
): Promise<GitHubRawData> {
  const [user, repos] = await Promise.all([
    ghFetch<GitHubUser>(`/users/${username}`, accessToken),
    fetchAllRepos(username, accessToken),
  ]);

  const [languages, recentCommits, starredTopics, readmeContent] =
    await Promise.all([
      fetchLanguages(repos, accessToken),
      fetchRecentCommits(repos, username, accessToken),
      fetchStarredTopics(username, accessToken),
      fetchReadme(repos, accessToken),
    ]);

  const contributionData = analyzeCommitTiming(recentCommits);

  return {
    user,
    repos,
    languages,
    recentCommits,
    starredTopics,
    readmeContent,
    contributionData,
  };
}
