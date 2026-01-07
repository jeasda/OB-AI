const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../src/lib/workflow_template.json');
const outputPath = path.join(__dirname, '../src/lib/workflow_api_converted.json');

try {
    const graphData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const apiData = {};

    // Helper to find valid widgets inputs
    // In ComfyUI graph, node.inputs lists input slots (both optional/required).
    // Some have 'widget' property indicating they map to a widget if not linked.
    // BUT widgets also include config parameters not listed in inputs (sometimes).
    // However, looking at the Qwen file, it seems most widgets are in 'inputs' with a 'widget' field.

    // Exception mapping for widgets that consume multiple values or are hidden
    // Standard Comfy Node 'KSampler' seed consumes 2 values (seed, control).

    graphData.nodes.forEach(node => {
        const outNode = {
            inputs: {},
            class_type: node.type,
            _meta: {
                title: node.title || node.type
            }
        };

        const inputsWithWidgets = node.inputs ? node.inputs.filter(i => i.widget) : [];
        const widgetsValues = node.widgets_values || [];

        // Map Links first (they override widgets usually, or are the only source)
        if (node.inputs) {
            node.inputs.forEach((input, index) => {
                if (input.link) {
                    // Find origin
                    // link is an ID. Find it in graphData.links
                    const linkId = input.link;
                    const linkDef = graphData.links.find(l => l[0] === linkId);
                    if (linkDef) {
                        const originId = String(linkDef[1]);
                        const originSlot = linkDef[2];
                        outNode.inputs[input.name] = [originId, originSlot];
                    }
                }
            });
        }

        // Map Widgets
        // We iterate through inputs that have widgets, and consume values from widgetsValues.
        // Special case: 'seed' usually allows 'control_after_generate' which is the NEXT value.
        // Note: This simple generic logic might fail for complex custom nodes, but trying best effort.

        let widgetValIndex = 0;

        // Strategy: iterate inputs. If it has a widget, take value.
        // IF element is NOT in inputs (pure widget), we might miss it if we only iterate inputs.
        // BUT API keys need names. Where do names come from if not in inputs?
        // In the Graph JSON, purely widget configs seem to BE in inputs with 'widget' key.

        if (node.inputs) {
            node.inputs.forEach(input => {
                if (input.widget) {
                    // If input is ALREADY linked, we technically shouldn't send the widget value in API
                    // BUT Comfy API usually tolerates it or we should prefer Link.
                    // However, we need to advance the widgetValIndex regardless.

                    if (widgetValIndex < widgetsValues.length) {
                        let val = widgetsValues[widgetValIndex];

                        // Special handling for Seed
                        if (input.name === 'seed' || input.name === 'noise_seed') {
                            // The next value is control_after_generate, which API doesn't strictly need in 'inputs' 
                            // unless specific node expects it. Standard KSampler seed is just int.
                            // But we need to skip the next value in widgets_values
                            widgetValIndex++; // Consume seed
                            widgetValIndex++; // Consume control_after_generate (skip)
                        } else {
                            widgetValIndex++;
                        }

                        // Only set if not already linked (API prefers link)
                        if (!outNode.inputs[input.name]) {
                            outNode.inputs[input.name] = val;
                        }
                    }
                }
            });
        }

        // Handling for 'image' and 'upload' in LoadImage
        // LoadImage inputs: "image" (widget), "upload" (widget)
        // widgets_values: ["filename", "image"]
        // input "image" gets "filename".
        // input "upload" gets "image". 
        // This seems correct.

        apiData[node.id] = outNode;
    });

    // Handle KSampler specifically if generic logic failed?
    // Let's verify KSampler (Node 3 or 340).
    // Inputs with widget: seed, steps, cfg, sampler_name, scheduler, denoise (6 inputs)
    // Widgets Values: [seed, control, steps, cfg, sampler, scheduler, denoise] (7 values)
    // My logic: 
    // - seed: consumes val[0], skips val[1].
    // - steps: consumes val[2].
    // - etc.
    // Should work.

    fs.writeFileSync(outputPath, JSON.stringify(apiData, null, 2));
    console.log('Conversion successful. Output:', outputPath);

} catch (err) {
    console.error('Conversion failed:', err);
}
