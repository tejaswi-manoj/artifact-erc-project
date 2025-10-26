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


export function runERC(diagram: any): { results: ERCResult[]; tests: TestInstruction[] } {
  const results: ERCResult[] = [
    ...checkFloatingWires(diagram),
    ...checkOrphanComponents(diagram),
    ...checkDuplicates(diagram),
    ...checkMultipleWires(diagram),
    ...checkPowerConnections(diagram),
    ...checkSerialConnections(diagram),
    ...checkMissingPartNames(diagram),
    ...checkMissingLengths(diagram),
  ];

  const tests = generateTestInstructions(diagram);

  return { results, tests };
}

// Checks for floating wires (edge does NOT Have a source or target)
function checkFloatingWires(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const edge of diagram.edges || []) {
    if (!edge.source || !edge.target) {
      results.push({
        id: edge.id,
        type: "error",
        message: `Wire ${edge.id} is floating — one end is not connected.`
      });
    }
  }
  return results;
}


// Checks for orphan components (a node whose id does not appear in any edge.source or edge.target)
function checkOrphanComponents(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const node of diagram.nodes || []) {
    let isOrphan: boolean = true;
    for (const edge of diagram.edges || []) {
      if (node.id === edge.source || node.id === edge.target) {
        isOrphan = false;
        break; 
      }
    }
    if (isOrphan) {
      results.push({
        id: node.id,
        type: "error",
        message: `Node ${node.id} is an orphan component.`,
      });
    }
  }

  return results;
}

// Check for duplicate reference names (two or more different nodes(IDs) have same ref name)

// for a given node, get ref name first:
// get data (if it exists), go to display properties if it exists
// loop through the array and return the first item whose key is reference name and get its value (e.g. battery 2)
// next, if ref name exists, then push the id to that ref name in hash map

function checkDuplicates(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];
  const nameMap = new Map<string, string[]>(); // name → list of node IDs

  // gather all reference names
  for (const node of diagram.nodes || []) {
    // for a given node, return its ref name if it exists
    const refName = node.data?.display_properties?.find((p: any) => p.key === "reference_name")?.value;
    // 
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

  // loop through all edges
  for (const edge of diagram.edges || []) {
    // Each edge has sourceHandle and targetHandle (the pins)
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
      results.push({
        type: "error",
        message: `Pin ${pin} has multiple wires connected (${edgeList.length} total).`,
        id: edgeList.join(", "),
      });
    }
  }

  return results;
}


// Check power connections

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
    ];

    for (const [a, b] of illegalCombos) {
      if (sourceFn === a && targetFn === b) {
        results.push({
          type: "error",
          id: edge.id,
          message: `Invalid power connection: ${sourceFn} → ${targetFn} on edge ${edge.id}`,
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
      results.push({
        type: "error",
        id: edge.id,
        message: `Invalid serial connection: ${sourceFn} → ${targetFn} on edge ${edge.id}`,
      });
    }
  }

  return results;
}

// Check missing part names

function checkMissingPartNames(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const node of diagram.nodes || []) {
    // Find the "part_name" property inside display_properties
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


// check missing lengths
function checkMissingLengths(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  for (const edge of diagram.edges || []) {
    const lengthProp = edge.data?.display_properties?.find(
      (prop: any) => prop.key === "length"
    )?.value;

    if (!lengthProp || lengthProp.trim() === "") {
      results.push({
        type: "warning",
        id: edge.id,
        message: `Wire/Cable ${edge.id} has no length assigned.`,
      });
    }
  }

  return results;
}



function generateTestInstructions(diagram: any): TestInstruction[] {
  const tests: TestInstruction[] = [];

  for (const edge of diagram.edges || []) {
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
