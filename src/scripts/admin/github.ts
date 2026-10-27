/**
 * The admin page has no server of its own: it reads and saves the shop's
 * files straight in the GitHub repository. Every "Publish" becomes one
 * commit, which makes the deploy workflow rebuild the site.
 */
const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type FileChange = { path: string; content: string | Blob } | { path: string; delete: true };

export type DeployStatus = 'pending' | 'success' | 'failure' | 'none' | 'unknown';

type TreeEntry = { path: string; mode: '100644'; type: 'blob'; sha: string | null };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class GitHub {
  constructor(private token: string, private repo: string, private branch: string) {}

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}/repos/${this.repo}${url}`, {
        method,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GitHubError('network', 0);
    }
    if (!res.ok) {
      let message = res.statusText;
      try { message = (await res.json()).message || message; } catch { /* keep statusText */ }
      throw new GitHubError(message, res.status);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  /** Whether the repository itself is reachable (to tell "no access" apart from "file missing"). */
  async canSeeRepo(): Promise<boolean> {
    try {
      await this.request('GET', '');
      return true;
    } catch {
      return false;
    }
  }

  /** Reads a text file from the branch, with the version id (sha) needed to save it safely later. */
  async readFile(path: string): Promise<{ text: string; sha: string }> {
    const data = await this.request<{ content: string; sha: string }>('GET', `/contents/${path}?ref=${encodeURIComponent(this.branch)}`);
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
    return { text: new TextDecoder().decode(bytes), sha: data.sha };
  }

  /**
   * Saves all changes as a single commit on the branch.
   * `guard` stops the save if that file was changed elsewhere since it was read,
   * so edits made on GitHub are never silently overwritten.
   * Returns the commit sha and the new version id of every written file.
   */
  async commit(message: string, changes: FileChange[], guard?: { path: string; sha: string }): Promise<{ commit: string; blobs: Record<string, string> }> {
    const blobs: Record<string, string> = {};
    // Upload file contents first: they don't depend on the branch moving.
    const writes = await Promise.all(
      changes.filter((c): c is Extract<FileChange, { content: string | Blob }> => 'content' in c).map(async (c) => {
        const body = typeof c.content === 'string'
          ? { content: c.content, encoding: 'utf-8' }
          : { content: await toBase64(c.content), encoding: 'base64' };
        const blob = await this.request<{ sha: string }>('POST', '/git/blobs', body);
        blobs[c.path] = blob.sha;
        return { path: c.path, mode: '100644', type: 'blob', sha: blob.sha } as TreeEntry;
      }),
    );
    const deletes = changes.filter((c) => 'delete' in c).map((c) => c.path);

    // If someone else commits at the same moment, start again from their commit once.
    for (let attempt = 0; ; attempt++) {
      const ref = await this.request<{ object: { sha: string } }>('GET', `/git/ref/heads/${this.branch}`);
      const parent = ref.object.sha;
      if (guard) {
        const current = await this.request<{ sha: string }>('GET', `/contents/${guard.path}?ref=${parent}`);
        if (current.sha !== guard.sha) throw new GitHubError('conflict', 409);
      }
      const { tree: baseTree } = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${parent}`);

      // GitHub refuses to delete a file that isn't there, so skip any that are already gone.
      let removals: TreeEntry[] = [];
      if (deletes.length) {
        const { tree } = await this.request<{ tree: { path: string }[] }>('GET', `/git/trees/${baseTree.sha}?recursive=1`);
        const existing = new Set(tree.map((t) => t.path));
        removals = deletes.filter((p) => existing.has(p)).map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null }));
      }

      const tree = await this.request<{ sha: string }>('POST', '/git/trees', { base_tree: baseTree.sha, tree: [...writes, ...removals] });
      const commit = await this.request<{ sha: string }>('POST', '/git/commits', { message, tree: tree.sha, parents: [parent] });
      try {
        await this.request('PATCH', `/git/refs/heads/${this.branch}`, { sha: commit.sha });
        return { commit: commit.sha, blobs };
      } catch (err) {
        if (attempt === 0 && err instanceof GitHubError && err.status === 422) continue;
        throw err;
      }
    }
  }

  /** How the site rebuild for a commit is going (needs the token's "Actions: read" permission). */
  async deployStatus(commitSha: string): Promise<DeployStatus> {
    try {
      const { workflow_runs: runs } = await this.request<{ workflow_runs: { status: string; conclusion: string | null }[] }>(
        'GET', `/actions/runs?head_sha=${commitSha}&per_page=20`,
      );
      if (!runs.length) return 'none';
      if (runs.some((r) => r.status !== 'completed')) return 'pending';
      if (runs.some((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure')) return 'failure';
      if (runs.every((r) => r.conclusion === 'success' || r.conclusion === 'skipped')) return 'success';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
