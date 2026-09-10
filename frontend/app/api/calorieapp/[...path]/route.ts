// Keep the legacy `/api/backend` route available for existing clients while
// exposing a brand-specific path that browser privacy filters do not block.
export {
  dynamic,
  GET,
  POST,
  DELETE,
} from "../../backend/[...path]/route";
