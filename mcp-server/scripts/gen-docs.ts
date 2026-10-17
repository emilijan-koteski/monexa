import { writeFileSync } from "node:fs";
import { excludedRoutes } from "../src/tools/excluded.js";
import { toolDefinitions } from "../src/tools/index.js";
import { renderToolsDoc, TOOLS_DOC_FILE } from "./tools-doc.js";

writeFileSync(TOOLS_DOC_FILE, renderToolsDoc(toolDefinitions, excludedRoutes));
console.log(`Wrote ${TOOLS_DOC_FILE} (${toolDefinitions.length} tools, ${excludedRoutes.length} excluded routes).`);
