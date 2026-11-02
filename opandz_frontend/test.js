const originalDocx = require('./public/docx.js');
const rawCode = `import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageOrientation,
} from "docx";

export function build_section_header() {
  return new Header({});
}

export function buildDocument(docx) {
  return new docx.Document({});
}`;

let cleaned = rawCode
  .replace(/import\s+[\s\S]*?\s+from\s+['"].*?['"];?/g, "") // Remove imports
  .replace(/export\s+default\s+/g, "") // Remove export default
  .replace(/export\s+function/g, "function") // Make export function local
  .replace(/const\s+docx\s*=\s*require\s*\(.*\);?/g, ""); // Remove require line

const keys = Object.keys(originalDocx).filter(k => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
const compileFn = new Function("docx", "require", `
  const { ${keys.join(", ")} } = docx;
  ${cleaned}
  if (typeof buildDocument === 'function') {
    return buildDocument;
  } else {
    throw new Error("Function 'buildDocument' not found in document code.");
  }
`);

try {
  const buildDocument = compileFn(originalDocx, () => {});
  console.log("Success:", buildDocument);
} catch (e) {
  console.error("Error:", e.message);
}
