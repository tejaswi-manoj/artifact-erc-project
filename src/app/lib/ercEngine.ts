// each JSON file can have nodes, edges, viewport, nets, preferences
// edges -> wires
// nodes -> device

export interface ERCResult {
  id?: string;
  type: "error" | "warning" | "info";
  message: string;
}

export function runERCChecks(diagram: any): ERCResult[] {
  const results: ERCResult[] = [];

  results.push(...checkFloatingWires(diagram));
  results.push(...checkOrphanComponents(diagram));
  results.push(...checkDuplicateReferenceNames(diagram));

  return results;

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

function checkDuplicateReferenceNames(diagram: any): ERCResult[] {
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

// Check if no pin 
