function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/, "");
  const full = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
  if (full) return { owner: full[1], repo: full[2] };
  const short = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (short) return { owner: short[1], repo: short[2] };
  return null;
}

export async function fetchRepoContent(
  repoUrl: string,
  ghToken?: string
): Promise<string> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error("Invalid GitHub URL. Use https://github.com/owner/repo");

  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(ghToken ? { Authorization: `Bearer ${ghToken}` } : {}),
  };

  const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
    fetch(base, { headers }),
    fetch(`${base}/readme`, { headers }),
    fetch(`${base}/git/trees/HEAD?recursive=1`, { headers }),
  ]);

  let content = `Repository: ${owner}/${repo}\n`;

  if (repoRes.status === "fulfilled" && repoRes.value.ok) {
    const d = await repoRes.value.json();
    if (d.message === "Not Found")
      throw new Error("Repository not found or is private. Make the repo public before submitting.");
    content += `Description: ${d.description ?? "none"}\n`;
    content += `Primary language: ${d.language ?? "unknown"}\n\n`;
  }

  if (readmeRes.status === "fulfilled" && readmeRes.value.ok) {
    const d = await readmeRes.value.json();
    const text = Buffer.from(d.content ?? "", "base64").toString("utf8");
    content += `README:\n${text.slice(0, 3000)}\n\n`;
  }

  if (treeRes.status === "fulfilled" && treeRes.value.ok) {
    const d = await treeRes.value.json();
    const allFiles: Array<{ type: string; path: string }> = d.tree ?? [];

    const treePreview = allFiles
      .filter((f) => !f.path.includes("node_modules") && !f.path.includes(".git"))
      .map((f) => `  ${f.type === "tree" ? "📁" : "📄"} ${f.path}`)
      .slice(0, 30)
      .join("\n");
    content += `File structure:\n${treePreview}\n\n`;

    const sourceExts = /\.(js|ts|jsx|tsx|py|java|cpp|c|go|rs|rb|php|cs|swift|kt)$/;
    const sourceFiles = allFiles
      .filter(
        (f) =>
          f.type === "blob" &&
          sourceExts.test(f.path) &&
          !f.path.includes("node_modules") &&
          !f.path.includes(".min.") &&
          !f.path.includes("dist/") &&
          f.path.split("/").length <= 4
      )
      .slice(0, 6);

    for (const file of sourceFiles) {
      try {
        const r = await fetch(`${base}/contents/${encodeURIComponent(file.path)}`, { headers });
        if (r.ok) {
          const fd = await r.json();
          const text = Buffer.from(fd.content ?? "", "base64").toString("utf8");
          content += `--- ${file.path} ---\n${text.slice(0, 1500)}\n\n`;
        }
      } catch { /* skip */ }
    }
  }

  return content;
}
