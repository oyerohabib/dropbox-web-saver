import type { SaveErrorCode } from "../types";

export class SavePipelineError extends Error {
  constructor(
    message: string,
    public readonly code: SaveErrorCode,
  ) {
    super(message);
  }
}
