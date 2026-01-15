import type { Env } from "../env";

type WorkflowContractInput = {
  service?: string;
  prompt?: string;
  ratio?: string;
  options?: Record<string, unknown> | null;
  imageFile?: File | null;
};

const allowedRatios = new Set(["1:1", "16:9", "9:16"]);

export function validateWorkflowContractV1(input: WorkflowContractInput) {
  const errors: string[] = [];

  if (input.service && input.service !== "qwen-image-edit") {
    return { ok: true, errors: [] };
  }
  if (!input.service && !input.imageFile) {
    return { ok: true, errors: [] };
  }

  if (!input.prompt || typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
    errors.push("prompt_required");
  }

  if (!input.ratio || !allowedRatios.has(input.ratio)) {
    errors.push("ratio_invalid");
  }

  if (!input.imageFile) {
    errors.push("image_required");
  }

  if (input.options && typeof input.options !== "object") {
    errors.push("options_invalid");
  }

  return { ok: errors.length === 0, errors };
}

export function buildWorkflowContext(env: Env) {
  return {
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    runpod_endpoint_id: env.RUNPOD_ENDPOINT,
  };
}
