// Run with: node scripts/test-parameter-help.mjs [catalog URL]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTs(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

async function main() {
  const { parameterHelp, missingParameterHelp, displayParameterValue, helpText, defaultStart } = loadTs("lib/parameterHelp.ts");
  const { modelDefaults } = loadTs("lib/cvCatalog.ts");
  const response = await fetch(process.argv[2] || "http://127.0.0.1:8000/api/model-catalog");
  assert(response.ok, `Catalog returned ${response.status}`);
  const catalog = await response.json();
  assert.deepEqual(missingParameterHelp(catalog), []);
  let checked = 0;
  for (const task of catalog.tasks) for (const model of task.models) {
    const before = JSON.stringify(model);
    const defaults = modelDefaults(model, catalog.common_params);
    for (const spec of [...catalog.common_params, ...model.params]) {
      const copy = parameterHelp(spec.key, model.id);
      for (const field of ["title", "summary", "effect"]) {
        assert(copy[field][0]?.trim() && copy[field][1]?.trim(), `${model.id}.${spec.key}.${field}`);
      }
      for (const language of ["en", "th"]) {
        assert(helpText(copy.start || defaultStart, language));
        assert(displayParameterValue(defaults.params[spec.key], spec, language));
        for (const option of spec.options || []) {
          assert.equal(displayParameterValue(option.value, spec, language), option.label);
        }
      }
      assert.equal(defaults.params[spec.key], model.safe_defaults?.[spec.key] ?? spec.default);
      checked++;
    }
    assert.equal(JSON.stringify(model), before, "Help must not mutate the model catalog");
  }
  for (const key of ["project_name", "task", "model", "dataset", "memory"]) assert(parameterHelp(key));
  assert.notDeepEqual(parameterHelp("image_size", "resnet"), parameterHelp("image_size", "faster_rcnn"));
  assert.notDeepEqual(parameterHelp("optimizer", "yolo"), parameterHelp("optimizer", "resnet"));
  assert.notDeepEqual(parameterHelp("momentum", "yolo"), parameterHelp("momentum", "resnet"));
  assert.notDeepEqual(parameterHelp("pretrained", "yolo"), parameterHelp("pretrained", "mask_rcnn"));
  assert.match(parameterHelp("num_classes").start[0], /automatically/);
  assert.equal(displayParameterValue(false, undefined, "en"), "Off");
  assert.equal(displayParameterValue(true, undefined, "th"), "เปิด");
  assert.equal(parameterHelp("unknown"), undefined);
  console.log(`PASS: ${checked} parameter/model combinations, bilingual content, defaults, option labels and contextual overrides`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
