# ⚡ Artifact ERC Checker

A web-based **Electrical Rule Check (ERC)** engine and visualization tool built with **Next.js**.  
It parses **Artifact diagram JSON files** (containing nodes and edges representing circuit components and wires) and runs automated validation checks to identify design issues like floating wires, orphan components, invalid power connections, and more.

---

## 🚀 Features

- **Real-time ERC Validation**
  - Detects common schematic and connection errors:
    - Floating wires or bundled wires  
    - Orphan components  
    - Duplicate reference names  
    - Multiple wires connected to a single pin  
    - Invalid power or serial connections  
    - Missing part names or wire lengths  

- **Dynamic Check Selection**
  - Enable or disable individual ERC tests interactively.  
  - Supports “Select All” and “Deselect All” functionality.

- **Interactive JSON Input**
  - Paste or upload Artifact diagram JSONs.  
  - Instantly parse and validate with one click.  
  - See clean, formatted output with categorized results.

- **Suggested Hardware Tests**
  - Automatically generates practical **continuity, power, signal, and mechanical** test instructions based on the diagram content.

- **Next.js + TypeScript + TailwindCSS**
  - Fully client-side rendered with modern UI, responsive layout, and fast performance.

---

## 🧰 How It Works

1. **Input:**  
   Paste a valid Artifact diagram JSON file describing nodes (devices) and edges (wires).

2. **Process:**  
   The built-in `runERC()` engine analyzes:
   - Connectivity between nodes and pins  
   - Pin functions (PWR, GND, TX/RX)  
   - Metadata such as part names, lengths, and insulation

3. **Output:**  
   Displays categorized ERC results and auto-generated hardware test instructions.

---

## 🧪 Example Checks

| Type | Description |
|------|--------------|
| ⚠️ Floating Wires | Wires with unconnected or ghost node ends |
| 🧩 Orphan Components | Components not connected to any wire |
| 🔌 Invalid Power Connections | PWR connected directly to GND or TX/RX |
| 🧠 Duplicate Names | Multiple components using the same reference name |
| 🧾 Missing Metadata | Components or wires missing required fields like `part_name` or `length` |

---
