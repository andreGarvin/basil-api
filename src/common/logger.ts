import { Snog } from "@openfin/snog";

export default new Snog({
  level:
    process.env.NODE_ENV === "dev" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_DEBUG
      ? 1
      : 2
});
