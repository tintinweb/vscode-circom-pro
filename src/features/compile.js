'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * */

const vscode = require("vscode");
const path = require("path");
const { CircomJS } = require("@zefi/circomjs")
const settings = require("../settings");


function fixCircuitPaths(c) {
    for (let k of Object.keys(c._circuitConfig).filter(key => key.endsWith('Path') || key.endsWith('Dir'))) {
        c._circuitConfig[k] = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, c._circuitConfig[k]).fsPath
    }
    return c;
}

function circomjsExceptionToVscode(e) {
    let msg = e.message.replace(/\[[\d;]+m/g, "").replace(/\x1b/gu, "");
    let loc = {
        line: 1,
        col: 1
    }
    settings.LOG(msg, '🔴')

    let parts = msg.match(/error\[([^\]]+)\]\s*:\s*([^\n]+)\n/);

    if (!parts) {
        parts = [
            "00000",
            "00000",
            "Circom Compiler Error"
        ]
    }

    let location = msg.match(/\"([^\"]+)\":(\d+):(\d+)/)
    let fname = '.';

    if (location) {
        loc.line = parseInt(location[2])
        loc.col = parseInt(location[3])
        fname = location[1]
    }

    const issue = {
        code: parts[1],
        message: `${e.operator} - ${parts[2]}`,
        range: new vscode.Range(
            new vscode.Position(loc.line - 1, loc.col - 1),
            new vscode.Position(loc.line - 1, 255)),
        severity: vscode.DiagnosticSeverity.Error,
        relatedInformation: []
    }

    let result = {};
    result[fname] = [issue];
    return result;
}

async function withCwd(cwd, f) {
    const current = process.cwd();
    process.chdir(cwd);
    await f();
    process.chdir(current);
}

class CircomCompiler {
    constructor() {
        this.diagnosticCollections = {
            compiler: vscode.languages.createDiagnosticCollection('Circom Compiler')
        };
        this.workspace = vscode.workspace.workspaceFolders[0];
    }


    async compile(options) {
        options = {
            //circuitId
            //inputFilePath: abspath,
            //generateProof = true|false
            //verifyProof = true|fale
            compile: true,
            generateProof: true,
            proofInput: undefined,
            verifyProof: true,
            proofData: undefined,
            //merge input options
            cancellationToken: undefined,
            ...options
        }
        await withCwd(this.workspace.uri.fsPath, async () => {
            const circomjs = new CircomJS();
            const allCids = circomjs.getCIDs();
            let cids = [];

            // fix circuits once and for all
            allCids.forEach(cid => fixCircuitPaths(circomjs.getCircuit(cid)));

            if (allCids.includes(options.circuitId)) {
                cids.push(options.circuitId);
            }

            if (options.inputFilePath) {
                allCids.map(c => circomjs.getCircuit(c))
                    .filter(f => f._circuitConfig.inputFilePath == options.inputFilePath)
                    .forEach(c => cids.push(c._circuitConfig.cId))
            }


            if (!options.circuitId && !options.inputFilePath && !cids.length) { // default to all
                cids = allCids;
            }


            for (let cid of [...new Set(cids)]) {
                if (options.cancellationToken.isCancellationRequested) {
                    settings.LOG("<debounce>", "🐟")
                    return;
                }


                let circuit = circomjs.getCircuit(cid);
                circuit._circuitConfig.baseName = path.basename(circuit._circuitConfig.inputFilePath, this.workspace.uri.fsPath);

                let data = (await vscode.workspace.openTextDocument(vscode.Uri.file(circuit._circuitConfig.inputFilePath))).getText()
                if (!data.match(/^\s*component\s+main\s+=[^;]+;\s*/gm)) {
                    settings.LOG("compiling circuit ... skipped (no main)", "👷", circuit._circuitConfig.baseName);
                    continue;
                }

                if (options.cancellationToken.isCancellationRequested) {
                    settings.LOG("<debounce>", "🐟")
                    return;
                }

                if (options.compile) {
                    settings.LOG("compiling circuit ...", "👷", circuit._circuitConfig.baseName);
                    await circuit.compile().then(() => {
                        this.diagnosticCollections.compiler.delete(vscode.Uri.file(circuit._circuitConfig.inputFilePath));
                    }).catch((e) => {
                        const issuesMap = circomjsExceptionToVscode(e);
                        for (let f of Object.keys(issuesMap)) {
                            this.diagnosticCollections.compiler.set(vscode.Uri.file(f && f == '.' ? circuit._circuitConfig.inputFilePath : f), issuesMap[f])
                        }
                    })
                }

                if (options.cancellationToken.isCancellationRequested) {
                    settings.LOG("<debounce>", "🐟")
                    return;
                }

                let input = options.proofInput;
                let proof = options.proofData;

                if (options.generateProof) {
                    settings.LOG("generateProof for circuit ...", "👷", circuit._circuitConfig.baseName);
                    if (input === undefined) {
                        try {
                            let _inputs = data.match(/\/\*\s*\n\s*(proof.input)\s*=\s*(\{.*\})/s);
                            if (!_inputs) {
                                settings.LOG("invalid proof input", "🔴");
                                throw new Error("no proof.input data found!")
                            }
                            input = JSON.parse(_inputs[2]);
                        } catch (e) {
                            settings.LOG("invalid proof input", "🔴");
                            vscode.window.showErrorMessage(`🔴 [${circuit._circuitConfig.baseName}] invalid proof input: ${_inputs}`);
                            continue
                        }

                    }

                    try {
                        settings.LOG("generating proof for input:", "👾", circuit._circuitConfig.baseName, input);
                        proof = await circuit.genProof(input);
                        settings.LOG("proof generated:", "👾", circuit._circuitConfig.baseName, proof);
                    } catch (e){
                        settings.LOG(e, "🔴", circuit._circuitConfig.baseName);
                        vscode.window.showErrorMessage(`🔴 [${circuit._circuitConfig.baseName}] exception generating proof for input: ${JSON.stringify(input)}`);
                        continue
                    }
                    
                }

                if (options.cancellationToken.isCancellationRequested) {
                    settings.LOG("<debounce>", "🐟")
                    return;
                }

                if (options.verifyProof) {
                    if (proof === undefined) {
                        try {
                            let _proof = data.match(/\/\*\s*\n\s*(proof.verify)\s*=\s*(\{.*\})/s)
                            if (!_proof) {
                                throw new Error("no proof.verify data found!")
                            }
                            input = JSON.parse(_proof[2]);
                        } catch (e) {
                            settings.LOG("invalid proof data", "🔴");
                            vscode.window.showErrorMessage(`🔴 [${circuit._circuitConfig.baseName}] invalid proof data: ${_proof}`);
                            continue
                        }

                    }
                    try {
                        const res = await circuit.verifyProof(proof);
                        if (res) {
                            settings.LOG(`proof verification successful!`, '👑', circuit._circuitConfig.baseName, res)
                            vscode.window.showInformationMessage(`✔️ [${circuit._circuitConfig.baseName}] proof verification successful!`);
                        }
                        else {
                            settings.LOG(`proof verification failed!`, '🔴', circuit._circuitConfig.baseName, res)
                            vscode.window.showErrorMessage(`🔴 [${circuit._circuitConfig.baseName}] proof verification failed!`);
                        }
                    } catch(e){
                        settings.LOG(e, "🔴", circuit._circuitConfig.baseName);
                        vscode.window.showErrorMessage(`🔴 [${circuit._circuitConfig.baseName}] exception verifying proof: ${JSON.stringify(proof)}`);
                        continue
                    }
                    
                }
            }
        });
        settings.LOG("done compiling circuit", '🏁')
    }

    async proof(curcuitId, input) {
        await withCwd(this.workspace.uri.fsPath, async () => {
            const circomjs = new CircomJS();
            const cids = curcuitId ? [curcuitId] : circomjs.getCIDs();
            for (let cid of cids) {
                let circuit = fixCircuitPaths(circomjs.getCircuit(cid));
                settings.LOG("compile ...", "👷", path.basename(circuit._circuitConfig.inputFilePath, this.workspace.uri.fsPath));
                await circuit.compile();

                input = input || {
                    a: 3,
                    b: 5
                }
                const proof = await circuit.genProof(input);
                console.settings.LOG(proof)
                const res = await circuit.verifyProof(proof);
                console.settings.LOG(res)
                if (res) {
                    console.settings.LOG("verification succeed")
                }
                else {
                    console.settings.LOG("verification failed")
                }
            }
        });
        settings.LOG("proof", '🏁')
    }
}

module.exports = {
    CircomCompiler
};