export type JobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface Job {
  id: string;
  status: JobStatus;

  prompt: string;

  input_image_url: string;
  output_image_url?: string;

  runpod_job_id?: string;

  error_message?: string;

  created_at: string;
  updated_at: string;
}
