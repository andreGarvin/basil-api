import * as types from "./types";

declare global {
  namespace Express {
    export interface Request {
      state?: types.State;
    }
  }

  namespace express {
    export interface Request {
      state?: types.State;
    }
  }
}
