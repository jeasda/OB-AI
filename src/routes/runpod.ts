import { errorResponse, getRequestId } from "../utils/http";
import { logEvent } from "../utils/log";

export default async function runpodHandler(request: Request, env: any) {
  const requestId = getRequestId(request);
  logEvent("warn", "runpod.route.deprecated", {
    requestId,
    timestamp: new Date().toISOString(),
  });
  return errorResponse("Deprecated: use submit proxy", requestId, 410);
}
