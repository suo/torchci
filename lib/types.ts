/**
 * Represents the individual job information returned by Rockset.
 */
export interface JobData {
  name: string;
  sha?: string;
  id?: string;
  conclusion?: string;
  htmlUrl?: string;
  logUrl?: string;
  durationS?: number;
  failureLine?: string;
  failureRule?: string;
  failureContext?: string;
  failureCaptures?: string;
}

export interface CommitData {
  sha: string;
  prUrl: string;
  diffNum: string;
  commitTitle: string;
  commitMessageBody: string;
  jobs: JobData[];
}

export interface RowData {
  sha: string;
  time: string;
  commitUrl: string;
  commitMessage: string;
  prNum: number;
  jobs: JobData[];
}

export interface HudData {
  shaGrid: RowData[];
  jobNames: string[];
}
