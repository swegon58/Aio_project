import { assertProductionEnvironment } from "../src/lib/aio/config/production-guard.mjs";

assertProductionEnvironment(process.env);
console.log("Aio production environment check passed.");
