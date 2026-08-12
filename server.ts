import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini AI Client lazily/safely
  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // AI Feature: OCR & Handwriting Text Recognition
  app.post("/api/ai/ocr", async (req, res) => {
    try {
      const { imageBase64, prompt } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const ai = getAi();
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            {
              text: prompt || "Recognize and transcribe all handwritten text, mathematical equations, bullet points, and structure from this image. Format as Markdown. If there are math formulas, write them in LaTeX style (e.g. $E=mc^2$).",
            },
          ],
        },
      });

      res.json({ text: response.text || "No text detected." });
    } catch (err: any) {
      console.error("OCR Error:", err);
      res.status(500).json({ error: err.message || "Failed to process OCR request" });
    }
  });

  // AI Feature: Beautify & Structure Handwriting
  app.post("/api/ai/beautify", async (req, res) => {
    try {
      const { imageBase64, mode, stylePreference } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      const ai = getAi();
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const instruction = mode === "script"
        ? "Analyze this handwriting image. Clean up all lines, align all text into neat horizontal baseline paragraphs, standardize letter shapes while preserving handwritten cursive script feel, fix messy strokes, straighten diagrams and arrows, and return structured JSON describing the extracted lines, paragraphs, shapes, and math expressions."
        : "Analyze this handwritten note image. Smooth jittery lines, fix letter slants, organize layout into clean sections, preserve handwritten aesthetic, and provide a cleaned-up OCR transcription and layout structure.";

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            {
              text: `${instruction}\nProvide output as a structured JSON object with keys: "transcript" (markdown string), "correctedScriptLines" (array of strings), "shapesDetected" (array of shape objects like {type: 'arrow'|'box'|'circle'|'underline', label: string}), and "suggestions" (array of tips to improve writing).`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (err: any) {
      console.error("Beautify Error:", err);
      res.status(500).json({ error: err.message || "Failed to beautify handwriting" });
    }
  });

  // AI Feature: Summarize Note
  app.post("/api/ai/summarize", async (req, res) => {
    try {
      const { text, imageBase64 } = req.body;
      const ai = getAi();

      const parts: any[] = [];
      if (imageBase64) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        });
      }
      if (text) {
        parts.push({ text: `Note text:\n${text}` });
      }
      parts.push({
        text: "Generate a concise executive summary, key takeaways, action items, and topic tags for these notes in JSON format with keys: 'summary', 'keyPoints' (array), 'actionItems' (array), and 'tags' (array).",
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: { parts },
        config: { responseMimeType: "application/json" },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      console.error("Summarize Error:", err);
      res.status(500).json({ error: err.message || "Failed to summarize notes" });
    }
  });

  // AI Feature: Equation Recognition & LaTeX conversion
  app.post("/api/ai/equation", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      const ai = getAi();
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/png", data: base64Data } },
            { text: "Identify all math symbols and equations in this handwritten snippet. Output JSON with: 'latex' (string), 'explanation' (string), and 'stepByStepSolution' (array of strings if applicable)." },
          ],
        },
        config: { responseMimeType: "application/json" },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      console.error("Equation Error:", err);
      res.status(500).json({ error: err.message || "Failed to parse equation" });
    }
  });

  // AI Feature: Translate Notes
  app.post("/api/ai/translate", async (req, res) => {
    try {
      const { text, targetLang } = req.body;
      const ai = getAi();

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Translate the following handwritten note transcript into ${targetLang || "Spanish"}:\n\n${text}`,
      });

      res.json({ translation: response.text });
    } catch (err: any) {
      console.error("Translate Error:", err);
      res.status(500).json({ error: err.message || "Failed to translate notes" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
