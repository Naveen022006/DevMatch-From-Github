export function isAdmin(githubUsername: string | undefined | null): boolean {
  if (!githubUsername) return false;
  const admins = (process.env.ADMIN_GITHUB_USERNAMES ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(githubUsername.toLowerCase());
}
