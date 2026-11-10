const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const extractResumeText = async (buffer) => {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  let fullText = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    fullText +=
      content.items.map((item) => item.str || "").join(" ") + "\n";
  }

  const text = fullText.trim();

  if (!text) {
    throw new Error(
      "No readable text found. Please upload a text-based PDF."
    );
  }

  return {
    text,
    pageCount: pdf.numPages
  };
};

module.exports = { extractResumeText };