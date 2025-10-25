"use client";
import { useState } from "react";

export default function Home() {
  const [jsonInput, setJsonInput] = useState("");
  const [output, setOutput] = useState("");

  function handleRunERC() {
    try {
      // Try to parse the JSON
      const parsed = JSON.parse(jsonInput);
      console.log("Parsed JSON:", parsed);

      // Temporary placeholder message
      setOutput("✅ JSON parsed successfully! (ERC logic coming soon...)");
    } catch (e: any) {
      setOutput("❌ Invalid JSON: " + e.message);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">⚡ Artifact ERC Checker</h1>

      <textarea
        className="w-full max-w-3xl h-64 border border-gray-300 rounded-lg p-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-[color:var(--foreground)] bg-[color:var(--background)] placeholder:text-gray-400"
        placeholder="Paste your Artifact diagram JSON here..."
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
      />

      <button
        onClick={handleRunERC}
        className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
      >
        Run ERC Checks
      </button>

      {output && (
        <div className="mt-6 w-full max-w-3xl bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-gray-800">
          {output}
        </div>
      )}
    </main>
  );
}
