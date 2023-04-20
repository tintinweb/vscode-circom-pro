'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * */

const BUILTINS = {
    "pragma custom_templates": {
        "prefix": "pragma custom_templates",
        "description": "Instruction to indicate the usage of custom templates.",
        "security": ""
    },
    "assert": {
        "prefix": "assert",
        "description": "Check the condition at construction time.",
        "security": ""
    },
    "component": {
        "prefix": "component",
        "description": "Instantiates a template.",
        "security": ""
    },
    "template": {
        "prefix": "template",
        "description": "Defines a new circuit.",
        "security": ""
    },
    "signal": {
        "prefix": "signal",
        "description": "Declares a new signal.",
        "security": ""
    },
    "input": {
        "prefix": "input",
        "description": "Declares the signal as input.",
        "security": ""
    },
    "output": {
        "prefix": "output",
        "description": "Declares the signal as output.",
        "security": ""
    },
    "public": {
        "prefix": "public",
        "description": "Declares the signal as public.",
        "security": ""
    },
    "parallel": {
        "prefix": "parallel",
        "description": "Generates C code with the parallel component or template.",
        "security": ""
    }
}

module.exports = {
    BUILTINS
}