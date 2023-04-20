'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * */

/** imports */
const vscode = require("vscode");
const { CancellationTokenSource } = require('vscode');
const settings = require("./settings");
const { provideHoverHandler } = require("./features/hover/hover");
const mod_deco = require("./features/deco");


/** global vars */
var activeEditor;
/** events */
async function onDidSave(document) {
    if (document.languageId != settings.LANGUAGE_ID) {
        return;
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

    /** hover provider */

    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ language: settings.LANGUAGE_ID }, {
            provideHover(document, position, token) {
                return provideHoverHandler(document, position, token, { language: settings.LANGUAGE_ID });
            }
        })
    );
}

/* exports */
exports.activate = onActivate;
