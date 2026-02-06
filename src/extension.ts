/**
 * extension.ts — The entry point for the Git Helper extension.
 *
 * VS Code calls the activate() function when the extension is loaded.
 * Think of this file as the "main()" of your extension.
 *
 * Here we:
 *   1. Create an Output Channel for displaying Git command results
 *   2. Register the sidebar Walkthrough panel
 *   3. Register the Quick Action commands (for the Command Palette)
 *
 * WHAT IS AN OUTPUT CHANNEL?
 *   It's a read-only text panel in the "Output" tab at the bottom of VS Code.
 *   You've probably seen it when running build tasks. We use it to log
 *   every Git command and its output, so users can always review details.
 *
 * WHAT IS THE COMMAND PALETTE?
 *   Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) to open it. It's the
 *   searchable list of all available commands. Our quick actions show up
 *   there with the "Git Helper:" prefix.
 */

import * as vscode from "vscode";
import { WalkthroughProvider } from "./walkthroughProvider";
import { runGitCommand } from "./gitCommands";

/**
 * Called by VS Code when the extension is activated (loaded).
 *
 * @param context - Provides utilities for managing the extension's lifecycle.
 *                  We add our disposables (things that need cleanup) to
 *                  context.subscriptions so VS Code can clean them up later.
 */
export function activate(context: vscode.ExtensionContext): void {
    // =========================================================
    // 1. CREATE THE OUTPUT CHANNEL
    // =========================================================
    // This is where all Git command output will be logged.
    // Users can view it: View > Output > select "Git Helper" from the dropdown.
    const outputChannel = vscode.window.createOutputChannel("Git Helper");
    outputChannel.appendLine("Git Helper extension activated!");
    outputChannel.appendLine("================================\n");

    // =========================================================
    // 2. REGISTER THE WALKTHROUGH SIDEBAR PANEL
    // =========================================================
    // This connects our WalkthroughProvider class to the view
    // defined in package.json. When the user clicks the Git Helper
    // icon in the Activity Bar, VS Code calls our provider to
    // generate the sidebar content.
    const walkthroughProvider = new WalkthroughProvider(outputChannel);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WalkthroughProvider.viewId, // "gitWalkthrough" — must match package.json
            walkthroughProvider
        )
    );

    // =========================================================
    // 3. REGISTER QUICK ACTION COMMANDS
    // =========================================================
    // These commands show up in the Command Palette (Ctrl/Cmd+Shift+P).
    // Each one runs a common Git operation with a single click.
    //
    // The command IDs (e.g., "gitHelper.status") must match what's
    // defined in package.json under "contributes.commands".

    // --- Git Helper: Status ---
    // Shows which files are modified, staged, or untracked.
    context.subscriptions.push(
        vscode.commands.registerCommand("gitHelper.status", async () => {
            const result = await runGitCommand(["status"], outputChannel);
            if (result.success) {
                vscode.window.showInformationMessage(
                    "Git status — check the Output panel for details."
                );
            }
        })
    );

    // --- Git Helper: Add All ---
    // Stages all changed files for the next commit.
    context.subscriptions.push(
        vscode.commands.registerCommand("gitHelper.add", async () => {
            const result = await runGitCommand(["add", "."], outputChannel);
            if (result.success) {
                vscode.window.showInformationMessage(
                    "All files staged successfully!"
                );
            }
        })
    );

    // --- Git Helper: Commit ---
    // Creates a commit with a user-provided message.
    context.subscriptions.push(
        vscode.commands.registerCommand("gitHelper.commit", async () => {
            // Ask the user to type a commit message
            const message = await vscode.window.showInputBox({
                prompt: "Enter your commit message",
                placeHolder: "e.g., Fix login button alignment",
            });

            // User pressed Escape or left it empty
            if (!message) {
                vscode.window.showWarningMessage(
                    "Commit cancelled — no message provided."
                );
                return;
            }

            // The message is passed as a separate arg (safe from injection)
            const result = await runGitCommand(
                ["commit", "-m", message],
                outputChannel
            );

            if (result.success) {
                vscode.window.showInformationMessage(
                    `Committed: "${message}"`
                );
            }
        })
    );

    // --- Git Helper: Push ---
    // Pushes local commits to the remote repository.
    context.subscriptions.push(
        vscode.commands.registerCommand("gitHelper.push", async () => {
            const result = await runGitCommand(["push"], outputChannel);
            if (result.success) {
                vscode.window.showInformationMessage(
                    "Pushed to remote successfully!"
                );
            }
        })
    );

    // --- Git Helper: Pull ---
    // Pulls the latest changes from the remote repository.
    context.subscriptions.push(
        vscode.commands.registerCommand("gitHelper.pull", async () => {
            const result = await runGitCommand(["pull"], outputChannel);
            if (result.success) {
                vscode.window.showInformationMessage(
                    "Pulled latest changes!"
                );
            }
        })
    );
}

/**
 * Called by VS Code when the extension is deactivated (unloaded).
 * We don't need any special cleanup, but VS Code requires this export.
 */
export function deactivate(): void {}
