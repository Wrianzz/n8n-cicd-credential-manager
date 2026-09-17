import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { config, assertValidBranchName, assertValidWorkflowId } from '../../config.js'
import { AppError } from '../../utils/app-error.js'

const execFileAsync = promisify(execFile)

export type BranchInfo = {
  branchName: string
  workflowId: string
  workflowName: string | null
  folderPath: string | null
  teamFolder: string | null
  headSha: string
  status: 'active'
}

type ExecOptions = {
  cwd?: string
  allowFailure?: boolean
}

export class GitService {
  constructor(
    private readonly repoPath = config.REPO_PATH,
    private readonly remote = config.GIT_REMOTE
  ) {}

  getRemoteName() {
    return this.remote
  }

  private async git(args: string[], options: ExecOptions = {}) {
    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd: options.cwd ?? this.repoPath,
        maxBuffer: 20 * 1024 * 1024
      })
      return { stdout: String(stdout), stderr: String(stderr) }
    } catch (err: any) {
      if (options.allowFailure) {
        return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? err.message ?? '') }
      }
      throw new AppError(500, 'GIT_COMMAND_FAILED', `Git command gagal: git ${args.join(' ')}`, {
        stderr: String(err.stderr ?? err.message ?? '')
      })
    }
  }

  async fetch() {
    await this.git(['fetch', '--prune', this.remote])
  }

  async listWorkflowBranches(query?: string): Promise<BranchInfo[]> {
    await this.fetch()
    const { stdout } = await this.git([
      'for-each-ref',
      `refs/remotes/${this.remote}/workflow`,
      '--format=%(refname:short)|%(objectname)'
    ])

    const branches = await Promise.all(stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(async (line) => {
        const [ref, sha] = line.split('|')
        const branchName = ref.replace(`${this.remote}/`, '')
        const workflowId = branchName.replace('workflow/', '')
        const [workflow, folderPath] = await Promise.all([
          this.readJsonFromBranch<unknown>(branchName, this.workflowJsonPath(workflowId)),
          this.readWorkflowFolderPath(branchName, workflowId)
        ])

        return {
          branchName,
          workflowId,
          workflowName: this.extractWorkflowName(workflow),
          folderPath,
          teamFolder: this.extractTeamFolder(folderPath),
          headSha: sha.slice(0, 12),
          status: 'active' as const
        }
      }))

    const normalizedQuery = query?.trim().toLowerCase()

    return branches.filter((branch) => !normalizedQuery || [
      branch.workflowId,
      branch.branchName,
      branch.workflowName,
      branch.folderPath,
      branch.teamFolder
    ].some((value) => value?.toLowerCase().includes(normalizedQuery)))
  }

  async getRemoteHeadSha(branchName: string): Promise<string> {
    assertValidBranchName(branchName)
    await this.fetch()
    const { stdout } = await this.git(['rev-parse', `${this.remote}/${branchName}`])
    return stdout.trim()
  }

  async readFileFromBranch(branchName: string, filePath: string): Promise<string | null> {
    assertValidBranchName(branchName)
    const safeFilePath = this.assertSafeRepoRelativePath(filePath)
    const { stdout, stderr } = await this.git(['show', `${this.remote}/${branchName}:${safeFilePath}`], {
      allowFailure: true
    })

    if (stderr.includes('exists on disk, but not in') || stderr.includes('does not exist') || stderr.includes('Path')) return null
    if (stderr && !stdout) return null
    return stdout
  }

  async readJsonFromBranch<T>(branchName: string, filePath: string): Promise<T | null> {
    const content = await this.readFileFromBranch(branchName, filePath)
    if (!content) return null
    try { return JSON.parse(content) as T } catch {
      throw new AppError(422, 'REPO_JSON_INVALID', `File ${filePath} bukan JSON valid.`, { filePath })
    }
  }

  workflowJsonPath(workflowId: string) { assertValidWorkflowId(workflowId); return `workflows/${workflowId}.json` }
  credentialMapPath(workflowId: string) { assertValidWorkflowId(workflowId); return `workflows/credential-maps/${workflowId}.credentials.json` }
  workflowMetadataPath(workflowId: string) { assertValidWorkflowId(workflowId); return `workflows/metadata/${workflowId}.meta` }

  async readWorkflowFolderPath(branchName: string, workflowId: string): Promise<string | null> {
    const content = await this.readFileFromBranch(branchName, this.workflowMetadataPath(workflowId))
    const folderPath = content?.trim()
    return folderPath || null
  }

  private extractTeamFolder(folderPath: string | null) {
    return folderPath?.split('/').map((segment) => segment.trim()).filter(Boolean)[0] ?? null
  }

  extractWorkflowName(workflow: unknown): string | null {
    if (Array.isArray(workflow)) return workflow.map((item) => this.extractWorkflowName(item)).find(Boolean) ?? null
    if (!workflow || typeof workflow !== 'object') return null
    const record = workflow as Record<string, unknown>
    const directName = record.name
    if (typeof directName === 'string' && directName.trim()) return directName.trim()
    return this.extractWorkflowName(record.workflow) ?? this.extractWorkflowName(record.data)
  }

  async withWorktree<T>(branchName: string, handler: (worktreePath: string) => Promise<T>): Promise<T> {
    assertValidBranchName(branchName)
    await this.fetch()
    const tempDir = await mkdtemp(path.join(tmpdir(), 'credential-manager-'))
    const worktreePath = path.join(tempDir, 'repo')
    try {
      await this.git(['worktree', 'add', '--detach', worktreePath, `${this.remote}/${branchName}`])
      await this.git(['config', 'user.name', 'Credential Manager'], { cwd: worktreePath })
      await this.git(['config', 'user.email', 'credential-manager@example.local'], { cwd: worktreePath })
      return await handler(worktreePath)
    } finally {
      await this.git(['worktree', 'remove', '--force', worktreePath], { allowFailure: true })
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  async writeRepoFile(worktreePath: string, repoRelativePath: string, content: string) {
    const safePath = this.assertSafeRepoRelativePath(repoRelativePath)
    const absolute = path.join(worktreePath, safePath)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content, 'utf8')
  }
  async readWorktreeFile(worktreePath: string, repoRelativePath: string): Promise<string | null> {
    const safePath = this.assertSafeRepoRelativePath(repoRelativePath)
    try { return await readFile(path.join(worktreePath, safePath), 'utf8') } catch { return null }
  }
  async diff(worktreePath: string): Promise<string> {
    const { stdout } = await this.git(['diff', '--', 'workflows/credential-maps'], { cwd: worktreePath }); return stdout
  }
  async hasChanges(worktreePath: string): Promise<boolean> {
    const { stdout } = await this.git(['status', '--porcelain', '--', 'workflows/credential-maps'], { cwd: worktreePath }); return stdout.trim().length > 0
  }
  async commitAndPush(worktreePath: string, branchName: string, message: string): Promise<string> {
    assertValidBranchName(branchName)
    await this.git(['add', 'workflows/credential-maps'], { cwd: worktreePath })
    await this.git(['commit', '-m', message], { cwd: worktreePath })
    const { stdout } = await this.git(['rev-parse', 'HEAD'], { cwd: worktreePath })
    const commitSha = stdout.trim()
    await this.git(['push', this.remote, `HEAD:${branchName}`], { cwd: worktreePath })
    return commitSha
  }
  private assertSafeRepoRelativePath(repoRelativePath: string) {
    const normalized = path.posix.normalize(repoRelativePath).replace(/^\/+/, '')
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) throw new AppError(400, 'INVALID_REPO_PATH', 'Path repository tidak valid.', { repoRelativePath })
    return normalized
  }
}

export const gitService = new GitService()
