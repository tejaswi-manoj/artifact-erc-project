"use client";
import { useState } from "react";
import { runERC } from "@/lib/ercEngine";

const CHECK_OPTIONS = [
  { id: 'floatingWires', label: 'Floating Wires', description: 'Check for wires with unconnected ends' },
  { id: 'floatingBundledWires', label: 'Floating Bundled Wires', description: 'Check for floating wires in cables' },
  { id: 'orphanComponents', label: 'Orphan Components', description: 'Check for components with no connections' },
  { id: 'duplicates', label: 'Duplicate Names', description: 'Check for duplicate reference names' },
  { id: 'multipleWires', label: 'Multiple Wires per Pin', description: 'Check for pins with multiple connections' },
  { id: 'powerConnections', label: 'Power Connections', description: 'Check for invalid power connections' },
  { id: 'serialConnections', label: 'Serial Connections', description: 'Check TX/RX connections' },
  { id: 'missingPartNames', label: 'Missing Part Names', description: 'Check for components without part names' },
  { id: 'missingLengths', label: 'Missing Wire Lengths', description: 'Check for wires without length specified' },
];


export default function Home() {
  const [jsonInput, setJsonInput] = useState("");
  const [output, setOutput] = useState("");
  const [enabledChecks, setEnabledChecks] = useState<Set<string>>(
  new Set(CHECK_OPTIONS.map(opt => opt.id))
  );

  
function handleRunERC() {
  try {
    const parsed = JSON.parse(jsonInput);
    console.log("Parsed JSON:", parsed);

    const { results, tests } = runERC(parsed); // ✅ call your ERC engine

    // ✅ Filter results based on enabled checks
    const filteredResults = results.filter(r => {
      const msg = r.message.toLowerCase();

      if (msg.includes("floating") && msg.includes("cable"))
        return enabledChecks.has("floatingBundledWires");
      if (msg.includes("floating"))
        return enabledChecks.has("floatingWires");
      if (msg.includes("orphan"))
        return enabledChecks.has("orphanComponents");
      if (msg.includes("duplicate"))
        return enabledChecks.has("duplicates");
      if (msg.includes("multiple wires"))
        return enabledChecks.has("multipleWires");
      if (msg.includes("power connection"))
        return enabledChecks.has("powerConnections");
      if (msg.includes("serial connection"))
        return enabledChecks.has("serialConnections");
      if (msg.includes("missing a part name"))
        return enabledChecks.has("missingPartNames");
      if (msg.includes("no length"))
        return enabledChecks.has("missingLengths");
      return true;
    });

    // ✅ Also filter test generation if needed (optional)
    const filteredTests = tests; // could add similar filtering by category if desired

    // ✅ Format nicely for display using *filtered* results
    const resultText =
      filteredResults.length === 0
        ? "✅ No ERC errors found!"
        : filteredResults
            .map(r => `${r.type.toUpperCase()}: ${r.message}`)
            .join("\n\n");

    const testText = filteredTests
      .map((t, idx) => `${idx + 1}. [${t.category}] ${t.instruction}`)
      .join("\n\n");

    setOutput(resultText + "\n\n🧰 Suggested Tests:\n\n" + testText);
  } catch (e: any) {
    setOutput("❌ Invalid JSON: " + e.message);
  }
}

  function handleClear() {
    setJsonInput("");
    setOutput("");
  }

  function toggleCheck(checkId: string) {
    setEnabledChecks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checkId)) {
        newSet.delete(checkId);
      } else {
        newSet.add(checkId);
      }
      return newSet;
    });
  }

  function toggleAll() {
    if (enabledChecks.size === CHECK_OPTIONS.length) {
      setEnabledChecks(new Set());
    } else {
      setEnabledChecks(new Set(CHECK_OPTIONS.map(opt => opt.id)));
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">⚡ Artifact ERC Checker</h1>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Checks Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Select Checks</h2>
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {enabledChecks.size === CHECK_OPTIONS.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {CHECK_OPTIONS.map(opt => (
              <label key={opt.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={enabledChecks.has(opt.id)}
                  onChange={() => toggleCheck(opt.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Right Column - Input and Output */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Diagram JSON</label>
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Clear
              </button>
            </div>
            <textarea
              className="w-full h-64 border border-gray-300 rounded-lg p-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white placeholder:text-gray-400"
              placeholder="Paste your Artifact diagram JSON here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
          </div>

          <button
            onClick={handleRunERC}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={!jsonInput.trim() || enabledChecks.size === 0}
          >
            {enabledChecks.size === 0 ? 'Select at least one check' : 'Run ERC Checks'}
          </button>

          {output && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-2">Results</h3>
              <div className="text-sm text-gray-800 whitespace-pre-line font-mono">
                {output}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
