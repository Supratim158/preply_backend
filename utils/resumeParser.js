
// Polyfill canvas-dependent globals to suppress PDF.js node warnings
// since we only extract text/annotations and do not render to canvas
if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = class DOMMatrix {};
}
if (!globalThis.Path2D) {
    globalThis.Path2D = class Path2D {};
}

const path = require("path");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const standardFontDir =
    path.join(__dirname, "../node_modules/pdfjs-dist/standard_fonts/") + path.sep;

async function parseResume(buffer) {
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: standardFontDir,
        disableFontFace: true,
        isEvalSupported: false,
        useSystemFonts: false,
    }).promise;

    let text = "";
    let links = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Extract text
        const content = await page.getTextContent();

        const pageText = content.items
            .map(item => item.str || "")
            .join(" ");

        text += pageText + "\n";

        // Extract clickable PDF links
        const annotations = await page.getAnnotations({
            intent: "display",
        });

        for (const annotation of annotations) {
            if (
                annotation.subtype === "Link" &&
                annotation.url
            ) {
                links.push(annotation.url);
            }
        }
    }

    // Extract visible URLs
    const urlRegex =
        /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

    const visibleLinks = text.match(urlRegex) || [];

    links = [...new Set([...links, ...visibleLinks])];

    return {
        text: text.trim(),
        pageCount: pdf.numPages,
        links,
    };
}

module.exports = parseResume;
