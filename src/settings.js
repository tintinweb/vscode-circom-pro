'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
/** imports */
const vscode = require('vscode');

const LANGUAGE_ID = "circom";
const SETTINGS_ID = "circompro";

function extensionConfig() {
    return vscode.workspace.getConfiguration(SETTINGS_ID);
}

function LOG(msg, prefix, file, data) {
    const logline = `${prefix ? prefix + ' ' : ''}(circom-pro)${file ? ` [${file}]` : ''} ${msg} ${data ? `\n${JSON.stringify(data, null, 2)}` : ""}`
    vscode.window.outputChannel?.appendLine(logline)
    console.log(logline);
}


module.exports = {
    LANGUAGE_ID: LANGUAGE_ID,
    SETTINGS_ID: SETTINGS_ID,
    extensionConfig: extensionConfig,
    LOG:LOG
};