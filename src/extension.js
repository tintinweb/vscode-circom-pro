'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * */

/** imports */
const vscode = require("vscode");
const { CancellationTokenSource } = require('vscode');
const settings = require("./settings");
const { CircomCompiler } = require("./features/compile");
const { provideHoverHandler } = require("./features/hover/hover");
const mod_deco = require("./features/deco");
const { CircuitConfig } = require("./features/commands");



/** global vars */
var activeEditor;
var suppressPopupShowShown = {
    generateConfig: false
}

const currentCancellationTokens = {
    onDidChange: new CancellationTokenSource(),
};
const compiler = new CircomCompiler();

function getCircuitConfigPath() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        // Construct the file URI
        return vscode.Uri.joinPath(workspaceFolder.uri, 'circuit.config.json');
    }
}

async function checkAutogenerateConfig() {
    const configFile = getCircuitConfigPath();
        
    // Check if the file already exists
    try {
        await vscode.workspace.fs.stat(configFile);
        return true;
    } catch (error) {
        if(suppressPopupShowShown.generateConfig){
            return false;
        }
        suppressPopupShowShown.generateConfig = true;
        let choice = await vscode.window.showInformationMessage('Project configuration file `circuit.config.json` not found. Create it?', "Create", "Abort");
        if(choice == "Create"){
            await vscode.commands.executeCommand(`${settings.SETTINGS_ID}.circuit.config.new`) 
            return true;
        }
    }
    return false;
}

/** events */
async function onDidSave(document) {
    if (document.languageId != settings.LANGUAGE_ID) {
        return;
    }

    //always run on save
    if (settings.extensionConfig().compile.onSave) {

        if(!await checkAutogenerateConfig()){
            return; //no config, nothing to do
        }

        currentCancellationTokens.onDidChange.cancel();
        currentCancellationTokens.onDidChange = new CancellationTokenSource();

        compiler.compile({
            cancellationToken: currentCancellationTokens.onDidChange.token,
            inputFilePath: document.uri.fsPath
        });
        vscode.window.outputChannel.show()
    }
}

async function onDidChange(event) {
    if (event?.document.languageId != settings.LANGUAGE_ID) {
        return;
    }

    if (settings.extensionConfig().decoration.enable) {
        mod_deco.decorateWords(activeEditor, [
            {
                regex: "(<--|-->)",
                hoverMessage: "❗**potentially unsafe** signal assignment",
                captureGroup: 0,
            }
        ], mod_deco.styles.foreGroundWarning);
    }
}

function onActivate(context) {

    const active = vscode.window.activeTextEditor;
    activeEditor = active;

    /** diag */
    context.subscriptions.push(compiler.diagnosticCollections.compiler);

    /** commands */
    context.subscriptions.push(
        vscode.commands.registerCommand(`${settings.SETTINGS_ID}.compile.this`, async () => {

            if(!await checkAutogenerateConfig()){
                return; //no config, nothing to do
            }

            currentCancellationTokens.onDidChange.cancel();
            currentCancellationTokens.onDidChange = new CancellationTokenSource();

            compiler.compile({
                cancellationToken: currentCancellationTokens.onDidChange.token,
                inputFilePath: vscode.window.activeTextEditor.document.uri.fsPath
            });
            vscode.window.outputChannel.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(`${settings.SETTINGS_ID}.compile.all`, () => {
            currentCancellationTokens.onDidChange.cancel();
            currentCancellationTokens.onDidChange = new CancellationTokenSource();

            return compiler.compile({
                cancellationToken: currentCancellationTokens.onDidChange.token,
            })
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(`${settings.SETTINGS_ID}.circuit.config.new`, async () => {
            const circuitConfig = new CircuitConfig("MyCircuits")
            const uris = await vscode.workspace.findFiles('{**/*.circom,*.circom}', '**​/node_modules/**', 300);
            for (let u of uris) {
                circuitConfig.addCircuitByFsPath(u.fsPath)
            }


            const fileUri = getCircuitConfigPath();
            if(!fileUri){
                return;
            }

            // Check if the file already exists
            try {
                await vscode.workspace.fs.stat(fileUri);
                settings.LOG('"circuit.config.json" already exists in the workspace. rename or remove the file to autogenerate a new one.',"🤷‍♂️")
                vscode.window.showWarningMessage('🤷‍♂️ "circuit.config.json" already exists in the workspace.');
            } catch (error) {
                // If the file does not exist, create it with the initial content of an empty JSON object
                await vscode.workspace.fs.writeFile(fileUri, new Uint8Array(Buffer.from(JSON.stringify(circuitConfig.config, null, 2))));
                settings.LOG('"circuit.config.json" created in the workspace.',"👍")
                vscode.window.showInformationMessage('👍 "circuit.config.json" created in the workspace.');
            }

            vscode.workspace.openTextDocument(fileUri).then(document => {
                vscode.window.showTextDocument(document);
            }, error => {
                vscode.window.showErrorMessage(`Failed to open "circuit.config.json": ${error}`);
            });
            
        })
    );

    /** register output channel */
    const outputChannel = vscode.window.createOutputChannel("Circom Pro");
    vscode.window.outputChannel = outputChannel
    context.subscriptions.push(outputChannel);
    settings.LOG("Welcome to Circom Pro (https://github.com/tintinweb/vscode-circom-pro).", "👑")
    settings.LOG("Please note that you can enable/disable certain featurs (autocomple, highlighting, etc.) in the vscode settings:\nvscode -> settings -> 'circompro.*'", "ℹ️")

    /** hover provider */
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: settings.LANGUAGE_ID }, {
            provideHover(document, position, token) {
                return provideHoverHandler(document, position, token, { language: settings.LANGUAGE_ID });
            }
        })
    );

    if (!settings.extensionConfig().mode.active) {
        console.log("ⓘ activate extension: entering passive mode. not registering any active code augmentation support.");
        return;
    }
    /** module init */
    onDidChange({ document: active.document });
    onDidSave(active.document);

    /** event setup */
    /***** OnChange */
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            onDidChange();
        }
    }, null, context.subscriptions);
    /***** OnChange */
    vscode.workspace.onDidChangeTextDocument(event => {
        activeEditor = vscode.window.activeTextEditor;
        if (event.document === activeEditor.document) {
            onDidChange(event);
        }
    }, null, context.subscriptions);
    /***** OnSave */

    vscode.workspace.onDidSaveTextDocument(document => {
        onDidSave(document);
    }, null, context.subscriptions);

    /****** OnOpen */
    vscode.workspace.onDidOpenTextDocument(document => {
        onDidSave(document);
    }, null, context.subscriptions);

    
}

/* exports */
exports.activate = onActivate;