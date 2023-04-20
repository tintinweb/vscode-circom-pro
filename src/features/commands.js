'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * */

const vscode = require("vscode");
const path = require("path");

function workspaceForFile(uri) {
    let workspace = vscode.workspace.getWorkspaceFolder(uri);
    return workspace ? workspace.uri : "";
}

class CircuitConfig {
    constructor(projectName, outputDir, inputDir) {
        this.config = {
            projectName: projectName,
            outputDir: outputDir || "./out",
            build: {
                inputDir: inputDir || "./circuits",
                circuits: [
                ]
            }
        }
    }

    addCircuitByFsPath(fsPath) {
        const ws = workspaceForFile(vscode.Uri.file(fsPath));
        let fname = path.basename(fsPath, ws.fsPath);
        let relpath = path.relative(ws.fsPath, fsPath)
        let firstdir = relpath.split(path.sep,1)[0];
        this.config.build.inputDir = `.${path.sep}${firstdir}`;
        relpath = path.relative(vscode.Uri.joinPath(ws, firstdir).fsPath, fsPath)
        this.addCircuit(fname.replace(".circom", ""), relpath)
    }

    addCircuit(cID, fileName, compilationMode) {
        this.config.build.circuits.push({
            cID: cID,
            fileName: fileName,
            compilationMode: compilationMode || "wasm"
        });
    }
}

module.exports = {
    CircuitConfig
}