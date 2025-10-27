// each JSON file can have nodes, edges
// edges -> wires
// nodes -> device

export interface ERCResult {
  id?: string;
  type: "error" | "warning" | "info";
  message: string;
}

export interface TestInstruction {
  id: string;             // edge or node id
  category: "continuity" | "power" | "signal" | "mechanical";
  instruction: string;    // the human-readable sentence
}

// add color utility for nicer terminal output
const colors = {
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
};


// run the full ERC
export function runERC(diagram: any): { results: ERCResult[]; tests: TestInstruction[] } {
  console.log(colors.cyan("\n🔍 Running ERC...\n"));

  const results: ERCResult[] = [
    ...checkFloatingWires(diagram),
    ...checkOrphanComponents(diagram),
    ...checkDuplicates(diagram),
    ...checkMultipleWires(diagram),
    ...checkPowerConnections(diagram),
    ...checkSerialConnections(diagram),
    ...checkMissingPartNames(diagram),
    ...checkMissingLengths(diagram),
    ...checkFloatingBundledWires(diagram)
  ];

  const tests = generateTestInstructions(diagram);

  // improved formatted console summary
  const errors = results.filter(r => r.type === "error");
  const warnings = results.filter(r => r.type === "warning");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(colors.green("✅ No ERC errors found!\n"));
  } else {
    if (errors.length > 0) {
      console.log(colors.red(`\n❌ ${errors.length} Error(s):`));
      errors.forEach(e => console.log(`   • ${colors.red(e.message)}\n`));
    }
    if (warnings.length > 0) {
      console.log(colors.yellow(`\n⚠️  ${warnings.length} Warning(s):`));
      warnings.forEach(w => console.log(`   • ${colors.yellow(w.message)}\n`));
    }
  }

  // ------------------------------
  // Better formatted Suggested Tests
  // ------------------------------
  if (tests.length > 0) {
    console.log(colors.cyan("\n🧰 Suggested Tests:\n"));
    tests.forEach((t, idx) => {
      console.log(` ${idx + 1}. [${colors.green(t.category)}] ${t.instruction}\n`);
    });
  } else {
    console.log(colors.green("\n✅ No test instructions generated.\n"));
  }

  console.log(colors.cyan("--------------------------------------------------\n"));
  return { results, tests };
}


// Helper function to get node name
function getNodeName(diagram: any, nodeId: string): string {
  const node = diagram.nodes?.find((n: any) => n.id === nodeId);
  if (!node) return nodeId;
  
  const refName = node.data?.display_properties?.find(
    (p: any) => p.key === "reference_name"
  )?.value;
  
  return refName || nodeId;
}


function getEdgeName(diagram: any, edgeId: string): string {
  const edge = diagram.edges?.find((e: any) => e.id === edgeId);
  if (!edge) return edgeId;
  
  const refName = edge.data?.display_properties?.find(
    (p: any) => p.key === "reference_name"
  )?.value;
  
  return refName || edgeId;
}


// Checks for floating wires (edge does NOT Have a source or target)
// Checks for floating wires (edge does NOT Have a source or target, OR connected to ghostNode)
function checkFloatingWires(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  
  // Build set of ghostNode IDs
  const ghostNodes = new Set(
    (diagram.nodes || [])
      .filter((n: any) => n.type === "ghostNode")
      .map((n: any) => n.id)
  );

  for (const edge of diagram.edges || []) {
    if (edge.type === "bundledEdge") continue; // skip bundled edges
    
    // Check if either end is missing or connected to a ghost node
    const sourceIsGhost = ghostNodes.has(edge.source);
    const targetIsGhost = ghostNodes.has(edge.target);
    
    if (!edge.source || !edge.target || sourceIsGhost || targetIsGhost) {
      const wireName = edge.data?.display_properties?.find((p: any) => p.key === "reference_name")?.value || edge.id;
      results.push({
        id: edge.id,
        type: "error",
        message: `Wire "${wireName}" is floating — one end is not connected.`
      });
    }
  }
  return results;
}


// Checks for orphan components (a node whose id does not appear in any edge.source or edge.target)
function checkOrphanComponents(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const node of diagram.nodes || []) {
    if (node.type === "bundleNode" || node.type === "ghostNode") continue; 
    let isOrphan: boolean = true;
    for (const edge of diagram.edges || []) {
      if (edge.type === "bundledEdge") continue;
      if (node.id === edge.source || node.id === edge.target) {
        isOrphan = false;
        break;
      }
    }
    if (isOrphan) {
      const refName = getNodeName(diagram, node.id);
      results.push({
        id: node.id,
        type: "error",
        message: `Component ${refName} is an orphan component.`,
      });
    }
  }

  return results;
}


// Check for duplicate reference names (two or more different nodes(IDs) have same ref name)
function checkDuplicates(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  const nameMap = new Map<string, string[]>(); // name → list of node IDs

  // gather all reference names
  for (const node of diagram.nodes || []) {
    if (node.type === "bundleNode" || node.type === "ghostNode") continue; 
    const refName = node.data?.display_properties?.find((p: any) => p.key === "reference_name")?.value;
    if (refName) {
      if (!nameMap.has(refName)) {
        nameMap.set(refName, []);
      }
      nameMap.get(refName)!.push(node.id);
    }
  }

  // find duplicates
  for (const [refName, ids] of nameMap.entries()) {
    if (ids.length > 1) {
      results.push({
        type: "error",
        message: `Duplicate reference name detected: "${refName}" appears ${ids.length} times.`,
        id: ids.join(", "),
      });
    }
  }

  return results;
}


// Check that no pin has multiple wires going into it 
function checkMultipleWires(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  const pinConnectionMap = new Map<string, string[]>(); // pinID → list of edge IDs

  // Build set of ghostNode IDs
  const ghostNodes = new Set(
    (diagram.nodes || [])
      .filter((n: any) => n.type === "ghostNode")
      .map((n: any) => n.id)
  );

  // loop through all edges
  for (const edge of diagram.edges || []) {
    if (edge.type === "bundledEdge") continue;

    if (ghostNodes.has(edge.source) || ghostNodes.has(edge.target)) continue;

    const sourcePin = edge.sourceHandle;
    const targetPin = edge.targetHandle;

    // For each pin, record that this edge is connected to it
    for (const pin of [sourcePin, targetPin]) {
      if (!pin) continue; // skip if missing
      if (!pinConnectionMap.has(pin)) {
        pinConnectionMap.set(pin, []);
      }
      pinConnectionMap.get(pin)!.push(edge.id);
    }
  }

  // detect pins with multiple wires
  for (const [pin, edgeList] of pinConnectionMap.entries()) {
    if (edgeList.length > 1) {
      const wireNames = edgeList.map(id => getEdgeName(diagram, id)).join(", ");
      results.push({
        type: "error",
        message: `Pin ${pin} has multiple wires connected: ${wireNames}`,
        id: edgeList.join(", "),
      });
    }
  }

  return results;
}


// Check power connections

// works

function checkPowerConnections(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  const pinMap = new Map<string, string>(); // pinID → function (PWR, GND, TX+, etc.)

  // build a lookup table for pin functions
  for (const node of diagram.nodes || []) {
    for (const port of node.data?.ports || []) {
      for (const pin of port.pins || []) {
        if (pin.id && pin.function) {
          pinMap.set(pin.id, pin.function.toUpperCase());
        }
      }
    }
  }

  //loop through all edges to check what connects to what
  for (const edge of diagram.edges || []) {
    if (edge.type === "bundledEdge") continue;
    const sourceFn = pinMap.get(edge.sourceHandle);
    const targetFn = pinMap.get(edge.targetHandle);

    if (!sourceFn || !targetFn) continue; // skip if missing

    // define “illegal” combinations
    const illegalCombos: [string, string][] = [
      ["PWR", "GND"],
      ["GND", "PWR"],
      ["PWR", "TX+"],
      ["PWR", "TX-"],
      ["PWR", "RX+"],
      ["PWR", "RX-"],
      ["TX+", "PWR"],
      ["TX-", "PWR"],
      ["RX+", "PWR"],
      ["RX-", "PWR"],
      ["GND", "TX+"], 
      ["GND", "TX-"], 
      ["GND", "RX+"], 
      ["GND", "RX-"],
      ["TX+", "GND"], 
      ["TX-", "GND"], 
      ["RX+", "GND"], 
      ["RX-", "GND"]
    ];

    for (const [a, b] of illegalCombos) {
      if (sourceFn === a && targetFn === b) {
        const wireName = getEdgeName(diagram, edge.id);
        results.push({
          type: "error",
          id: edge.id,
          message: `Invalid power connection on wire "${wireName}": ${sourceFn} → ${targetFn}`,
        });
      }
    }
  }

  return results;
}


// Check serial connections
function checkSerialConnections(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  const pinMap = new Map<string, string>(); // pinID → function

  // 1️⃣ Build lookup of pinID → function
  for (const node of diagram.nodes || []) {
    for (const port of node.data?.ports || []) {
      for (const pin of port.pins || []) {
        if (pin.id && pin.function) {
          pinMap.set(pin.id, pin.function.toUpperCase());
        }
      }
    }
  }

  // 2️⃣ Loop through edges and compare functions
  for (const edge of diagram.edges || []) {
    const sourceFn = pinMap.get(edge.sourceHandle);
    const targetFn = pinMap.get(edge.targetHandle);

    if (!sourceFn || !targetFn) continue;

    // Only care about serial signals
    const serialPins = ["TX+", "TX-", "RX+", "RX-"];
    if (!serialPins.includes(sourceFn) || !serialPins.includes(targetFn)) continue;

    // correct connection
    const validCombos = [
      ["TX+", "RX+"],
      ["TX-", "RX-"],
      ["RX+", "TX+"],
      ["RX-", "TX-"],
    ];

    const isValid = validCombos.some(([a, b]) => sourceFn === a && targetFn === b);
    if (!isValid) {
      const wireName = getEdgeName(diagram, edge.id);
      results.push({
        type: "error",
        id: edge.id,
        message: `Invalid serial connection on wire "${wireName}": ${sourceFn} → ${targetFn}`,
      });
    }
  }

  return results;
}


// Check that part names have been assigned to all components in the drawing
function checkMissingPartNames(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const node of diagram.nodes || []) {
    if (node.type === "bundleNode" || node.type === "ghostNode") continue; 
    const partName = node.data?.display_properties?.find(
      (prop: any) => prop.key === "part_name"
    )?.value;

    if (!partName || partName.trim() === "") {
      results.push({
        type: "warning",
        id: node.id,
        message: `Component ${node.id} is missing a part name.`,
      });
    }
  }

  return results;
}


// Check that lengths have been assigned to all wires and cables
function checkMissingLengths(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const edge of diagram.edges || []) {
    if (edge.type === "bundledEdge") continue;
    const lengthProp = edge.data?.display_properties?.find(
      (prop: any) => prop.key === "length"
    )?.value;

    if (!lengthProp || lengthProp.trim() === "") {
      const wireName = getEdgeName(diagram, edge.id);
      results.push({
        type: "warning",
        id: edge.id,
        message: `Wire "${wireName}" has no length assigned.`,
      });
    }
  }

  return results;
}


// Present suggested test instructions to the user
function generateTestInstructions(diagram: any): TestInstruction[] {
  const tests: TestInstruction[] = [];

  for (const edge of diagram.edges || []) {
    if (edge.type === "bundledEdge") continue;
    const props = edge.data?.display_properties || [];
    const refName = props.find((p: any) => p.key === "reference_name")?.value;
    const insulation = props.find((p: any) => p.key === "insulation")?.value;
    const length = props.find((p: any) => p.key === "length")?.value;
    const color = insulation ? insulation.toUpperCase() : "unknown color";

    // 1️⃣ Continuity test
    tests.push({
      id: edge.id,
      category: "continuity",
      instruction: `Perform a continuity check along wire ${refName || edge.id} (${color}). Ensure resistance < 1 Ω.`,
    });

    // 2️⃣ Length verification
    if (length) {
      tests.push({
        id: edge.id,
        category: "mechanical",
        instruction: `Measure and confirm wire ${refName || edge.id} length = ${length} in.`,
      });
    }

    // 3️⃣ Power verification
    const hasPWR = props.some((p: any) => p.value?.toUpperCase().includes("PWR"));
    const hasGND = props.some((p: any) => p.value?.toUpperCase().includes("GND"));
    if (hasPWR && hasGND) {
      tests.push({
        id: edge.id,
        category: "power",
        instruction: `Using a multimeter, verify ${refName || edge.id} delivers correct voltage between PWR and GND.`,
      });
    }

    // 4️⃣ Signal verification
    const hasTX = props.some((p: any) => p.value?.toUpperCase().includes("TX"));
    const hasRX = props.some((p: any) => p.value?.toUpperCase().includes("RX"));
    if (hasTX || hasRX) {
      tests.push({
        id: edge.id,
        category: "signal",
        instruction: `Use an oscilloscope to validate ${refName || edge.id} signal integrity (${hasTX ? "TX" : "RX"} line).`,
      });
    }
  }

  return tests;
}


// Check for floating bundled edges (wires inside cables)
function checkFloatingBundledWires(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  
  // Build set of ghostNode IDs
  const ghostNodes = new Set(
    (diagram.nodes || [])
      .filter((n: any) => n.type === "ghostNode")
      .map((n: any) => n.id)
  );

  for (const edge of diagram.edges || []) {
    if (edge.type !== "bundledEdge") continue; // only check bundled edges
    
    // Check if either end is missing or connected to a ghost node
    const sourceIsGhost = ghostNodes.has(edge.source);
    const targetIsGhost = ghostNodes.has(edge.target);
    
    if (!edge.source || !edge.target || sourceIsGhost || targetIsGhost) {
      const insulation = edge.data?.display_properties?.find((p: any) => p.key === "insulation")?.value;
      const parentEdge = diagram.edges.find((e: any) => e.id === edge.data?.parent_id);
      const cableName = parentEdge?.data?.display_properties?.find((p: any) => p.key === "reference_name")?.value || "Unknown cable";
      
      results.push({
        id: edge.id,
        type: "error",
        message: `Wire in cable "${cableName}" (${insulation || "unknown color"}) is floating — one end is not connected.`
      });
    }
  }
  return results;
}