/**
 * walkthroughProvider.ts — Creates and manages the Git Walkthrough sidebar panel.
 *
 * This file implements a WebviewViewProvider, which is VS Code's way of
 * putting custom HTML content into a sidebar panel.
 *
 * WHY WEBVIEW INSTEAD OF TREEVIEW?
 *   VS Code offers two ways to build sidebar panels:
 *   - TreeView: Great for simple lists (like a file explorer), but limited
 *     when you need rich content like paragraphs, code blocks, and buttons.
 *   - WebviewView: Lets you use HTML/CSS/JS to build any UI you want.
 *   Since our walkthrough needs descriptions, styled command previews,
 *   interactive buttons, and output displays, Webview is the better fit.
 *   Plus, if you know HTML, it's more familiar than TreeView's API!
 *
 * HOW IT WORKS:
 *   1. VS Code calls resolveWebviewView() when the user opens the sidebar panel
 *   2. We generate HTML with all the walkthrough steps
 *   3. When the user clicks "Run Step", the webview sends a message to the extension
 *   4. The extension runs the Git command and sends the result back
 *   5. The webview updates to show success/failure and command output
 *
 * MESSAGE FLOW:
 *   [Webview HTML/JS]  --postMessage-->  [Extension TypeScript]
 *   [Extension TypeScript]  --postMessage-->  [Webview HTML/JS]
 */

import * as vscode from "vscode";
import { WALKTHROUGH_STEPS, WalkthroughStep } from "./steps";
import { runGitCommand, GitCommandResult } from "./gitCommands";

/**
 * Provides the webview content for the Git Walkthrough sidebar panel.
 *
 * This class is registered with VS Code in extension.ts. VS Code will
 * automatically call resolveWebviewView() when the panel needs to be shown.
 */
export class WalkthroughProvider implements vscode.WebviewViewProvider {
    /**
     * This ID must EXACTLY match the "id" in package.json under "views".
     * It's how VS Code knows which provider goes with which panel.
     */
    public static readonly viewId = "gitWalkthrough";

    /** Store a reference to the webview so we can send messages to it later */
    private _view?: vscode.WebviewView;

    /**
     * @param _outputChannel - The Output Channel where Git command results are logged.
     *                        This is the same channel used by the quick action commands.
     */
    constructor(private readonly _outputChannel: vscode.OutputChannel) {}

    // =============================================================
    // WebviewViewProvider Implementation
    // =============================================================

    /**
     * Called by VS Code when the sidebar panel is first opened.
     * This is where we set up the webview's HTML and message handling.
     */
    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        // Allow JavaScript to run inside the webview.
        // We need this for button click handlers and receiving messages.
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Set the HTML content for the walkthrough panel
        webviewView.webview.html = this._getHtmlContent();

        // Listen for messages sent FROM the webview (e.g., button clicks).
        // When the user clicks "Run Step", the webview's JS sends us a message.
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessage(message);
        });
    }

    // =============================================================
    // Message Handling
    // =============================================================

    /**
     * Handles messages sent from the webview JavaScript.
     *
     * The webview sends messages like: { type: "runStep", stepId: "check-git" }
     * We find the matching step, run its Git command, and send the result back.
     */
    private async _handleMessage(message: { type: string; stepId: string }): Promise<void> {
        // We only handle "runStep" messages right now
        if (message.type !== "runStep") {
            return;
        }

        // Find the step definition that matches the clicked button
        const step = WALKTHROUGH_STEPS.find((s) => s.id === message.stepId);
        if (!step) {
            return;
        }

        // Copy the default args so we don't modify the original step data
        let args = [...step.args];

        // --- Handle steps that need user input ---
        // Some steps (like commit and add-remote) need the user to type something.
        // We show a VS Code input box and append their answer to the args.
        if (step.requiresInput) {
            const userInput = await vscode.window.showInputBox({
                prompt: step.requiresInput.prompt,
                placeHolder: step.requiresInput.placeholder,
            });

            // If the user pressed Escape or left it empty, cancel the step
            if (userInput === undefined || userInput.trim() === "") {
                this._sendResultToWebview(step.id, {
                    success: false,
                    output: "Cancelled — no input provided.",
                });
                return;
            }

            // Append the user's input to the args array.
            // For commit: ["commit", "-m"] + ["my message"] → git commit -m "my message"
            // For remote: ["remote", "add", "origin"] + ["https://..."] → git remote add origin https://...
            // Because we use execFile (not exec), this is safe from injection!
            args.push(userInput);
        }

        // Tell the webview this step is now running (shows a spinner/status)
        this._sendStatusToWebview(step.id, "running");

        // Actually run the Git command
        const result = await runGitCommand(args, this._outputChannel);

        // Send the result back to the webview to update the UI
        this._sendResultToWebview(step.id, result);
    }

    // =============================================================
    // Sending Messages Back to the Webview
    // =============================================================

    /**
     * Sends a status update to the webview (e.g., "running").
     * The webview's JavaScript listens for these messages and updates the UI.
     */
    private _sendStatusToWebview(stepId: string, status: string): void {
        this._view?.webview.postMessage({
            type: "status",
            stepId,
            status,
        });
    }

    /**
     * Sends a command result to the webview (success/fail + output text).
     */
    private _sendResultToWebview(stepId: string, result: GitCommandResult): void {
        this._view?.webview.postMessage({
            type: "result",
            stepId,
            success: result.success,
            output: result.output,
        });
    }

    // =============================================================
    // HTML Generation
    // =============================================================

    /**
     * Generates the full HTML page for the walkthrough panel.
     *
     * This returns a complete HTML document with:
     *   - CSS styles that match the VS Code theme (using CSS variables)
     *   - A card for each walkthrough step
     *   - JavaScript to handle button clicks and display results
     *
     * VS CODE THEME INTEGRATION:
     *   We use CSS variables like `var(--vscode-foreground)` instead of
     *   hardcoded colors. This means the walkthrough automatically matches
     *   whatever color theme the user has selected (dark, light, etc.)!
     */
    private _getHtmlContent(): string {
        // Build the HTML for each step card
        const stepsHtml = WALKTHROUGH_STEPS.map((step) =>
            this._getStepHtml(step)
        ).join("\n");

        return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Git Walkthrough</title>
    <style>
        /* ========================================
           BASE STYLES
           Uses VS Code's CSS variables so the UI
           automatically matches the user's theme.
           ======================================== */
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 0 12px 12px 12px;
            margin: 0;
        }

        /* ========================================
           HEADER
           ======================================== */
        .header {
            text-align: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 12px;
        }

        .header h1 {
            font-size: 1.3em;
            margin: 0 0 4px 0;
        }

        .header p {
            margin: 0;
            opacity: 0.75;
            font-size: 0.9em;
        }

        /* ========================================
           STEP CARDS
           Each step is a "card" with a border.
           ======================================== */
        .step-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .step-title {
            font-weight: bold;
            font-size: 1.05em;
            margin: 0 0 6px 0;
        }

        .step-description {
            margin: 0 0 8px 0;
            line-height: 1.5;
            opacity: 0.9;
        }

        /* The Git command shown in a code-style box */
        .step-command {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 6px 10px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.95em;
            margin-bottom: 8px;
            word-break: break-all;
        }

        /* Tip/note text below the command */
        .step-notes {
            font-size: 0.9em;
            opacity: 0.7;
            margin-bottom: 8px;
            font-style: italic;
        }

        /* ========================================
           BUTTONS
           ======================================== */
        .run-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            padding: 6px 16px;
            cursor: pointer;
            font-size: 0.95em;
        }

        .run-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .run-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* ========================================
           STATUS & OUTPUT
           Shown after a step is run.
           ======================================== */
        .step-status {
            margin-top: 8px;
            font-size: 0.9em;
        }

        .status-running {
            color: var(--vscode-charts-yellow);
        }

        .status-success {
            color: var(--vscode-charts-green);
        }

        .status-error {
            color: var(--vscode-charts-red);
        }

        /* Box that shows the command output */
        .step-output {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px;
            margin-top: 6px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.85em;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 150px;
            overflow-y: auto;
        }
    </style>
</head>
<body>

    <!-- Header -->
    <div class="header">
        <h1>Git Walkthrough</h1>
        <p>Follow these steps to learn Git, one at a time!</p>
    </div>

    <!-- Step Cards (generated from the steps array) -->
    ${stepsHtml}

    <script>
        // ========================================
        // WEBVIEW JAVASCRIPT
        // ========================================
        // This code runs INSIDE the webview (the sidebar panel).
        // It handles button clicks and listens for results from
        // the extension (walkthroughProvider.ts).

        // The vscode API lets us send messages to the extension.
        // acquireVsCodeApi() is a special function available in VS Code webviews.
        const vscode = acquireVsCodeApi();

        /**
         * Called when the user clicks a "Run Step" button.
         * Sends a message to the extension to run the Git command.
         *
         * @param {string} stepId - The step's unique ID (matches step.id in steps.ts)
         */
        function runStep(stepId) {
            // Disable the button so the user can't click it again while running
            const button = document.getElementById('btn-' + stepId);
            if (button) {
                button.disabled = true;
                button.textContent = 'Running...';
            }

            // Send a message to the extension.
            // walkthroughProvider.ts will receive this in _handleMessage().
            vscode.postMessage({
                type: 'runStep',
                stepId: stepId
            });
        }

        /**
         * Listen for messages FROM the extension (command results).
         *
         * The extension sends two types of messages:
         *   1. { type: "status", stepId, status: "running" }  — step is in progress
         *   2. { type: "result", stepId, success, output }    — step is done
         */
        window.addEventListener('message', (event) => {
            const message = event.data;

            // Get references to the UI elements for this step
            const statusEl = document.getElementById('status-' + message.stepId);
            const outputEl = document.getElementById('output-' + message.stepId);
            const button = document.getElementById('btn-' + message.stepId);

            // --- Handle "running" status ---
            if (message.type === 'status') {
                if (statusEl) {
                    statusEl.className = 'step-status status-running';
                    statusEl.textContent = 'Running...';
                }
            }

            // --- Handle command result ---
            if (message.type === 'result') {
                // Re-enable the button so the user can run it again
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Run Step';
                }

                // Show success or error status
                if (statusEl) {
                    if (message.success) {
                        statusEl.className = 'step-status status-success';
                        statusEl.textContent = 'Success!';
                    } else {
                        statusEl.className = 'step-status status-error';
                        statusEl.textContent = 'Error (see output below)';
                    }
                }

                // Show the command's output
                if (outputEl) {
                    outputEl.textContent = message.output;
                    outputEl.style.display = 'block';
                }
            }
        });
    </script>

</body>
</html>`;
    }

    /**
     * Generates the HTML for a single walkthrough step card.
     *
     * Each card has:
     *   - Title (e.g., "1. Check Git is Installed")
     *   - Description (plain English explanation)
     *   - Command preview (styled like a code block)
     *   - Optional tip/notes
     *   - "Run Step" button
     *   - Status text (hidden until the step is run)
     *   - Output area (hidden until the step is run)
     */
    private _getStepHtml(step: WalkthroughStep): string {
        // Only show the notes section if this step has notes
        const notesHtml = step.notes
            ? `<p class="step-notes">Tip: ${step.notes}</p>`
            : "";

        return /*html*/ `
        <div class="step-card" id="card-${step.id}">
            <p class="step-title">${step.title}</p>
            <p class="step-description">${step.description}</p>
            <div class="step-command">${step.command}</div>
            ${notesHtml}
            <button class="run-button" id="btn-${step.id}" onclick="runStep('${step.id}')">
                Run Step
            </button>
            <div class="step-status" id="status-${step.id}"></div>
            <div class="step-output" id="output-${step.id}" style="display: none;"></div>
        </div>`;
    }
}
