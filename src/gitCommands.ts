/**
 * gitCommands.ts — Handles running Git commands and capturing output.
 *
 * This module provides a single function that:
 *   1. Runs a Git command in the current workspace folder
 *   2. Captures the output (stdout and stderr)
 *   3. Writes the output to VS Code's Output Channel
 *   4. Returns the result so the UI can show success/failure
 *
 * SECURITY NOTE:
 *   We use `execFile` instead of `exec` here. The difference:
 *   - exec("git commit -m " + userInput)  ← DANGEROUS! If userInput contains
 *     shell characters like ; or &&, they could run arbitrary commands.
 *   - execFile("git", ["commit", "-m", userInput])  ← SAFE! User input is
 *     passed as a separate argument, never interpreted by the shell.
 *   This is called "avoiding command injection" — an important security concept!
 */

import * as vscode from "vscode";
import { execFile } from "child_process";

// =============================================================
// Types
// =============================================================

/**
 * The result of running a Git command.
 */
export interface GitCommandResult {
    /** Whether the command succeeded (exit code 0) */
    success: boolean;
    /** The command's output text (stdout + stderr combined) */
    output: string;
}

// =============================================================
// Main Function
// =============================================================

/**
 * Runs a Git command in the current workspace folder.
 *
 * @param args - The arguments to pass to `git` (e.g., ["status"] runs `git status`)
 * @param outputChannel - VS Code OutputChannel to log results to
 * @returns A promise that resolves with the command result
 *
 * Examples:
 *   runGitCommand(["status"], outputChannel)           → runs `git status`
 *   runGitCommand(["commit", "-m", "hello"], channel)  → runs `git commit -m "hello"`
 *   runGitCommand(["push", "-u", "origin", "main"])    → runs `git push -u origin main`
 */
export function runGitCommand(
    args: string[],
    outputChannel: vscode.OutputChannel
): Promise<GitCommandResult> {
    return new Promise((resolve) => {
        // --- Step 1: Get the workspace folder ---
        // This is the folder the user has open in VS Code.
        // Git commands need to run inside the project folder to work correctly.
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            const errorMsg =
                "No folder is open in VS Code. Please open a folder first " +
                "(File > Open Folder).";
            outputChannel.appendLine(`ERROR: ${errorMsg}`);
            outputChannel.show();
            vscode.window.showErrorMessage(errorMsg);
            resolve({ success: false, output: errorMsg });
            return;
        }

        const cwd = workspaceFolders[0].uri.fsPath;

        // --- Step 2: Log what we're about to run ---
        // Format the command nicely for display (quote args that contain spaces)
        const displayCmd =
            "git " +
            args
                .map((a) => (a.includes(" ") ? `"${a}"` : a))
                .join(" ");
        outputChannel.appendLine(`> ${displayCmd}`);
        outputChannel.appendLine(`  (in: ${cwd})`);
        outputChannel.appendLine("---");

        // --- Step 3: Execute the command ---
        // execFile runs the "git" binary directly with the given arguments.
        // Unlike exec(), it does NOT pass through a shell, which makes it
        // safe even if args contain special characters.
        execFile("git", args, { cwd }, (error, stdout, stderr) => {
            // Combine stdout and stderr so the user sees everything
            const output = (stdout + stderr).trim();

            if (error) {
                // Command failed (non-zero exit code)
                outputChannel.appendLine(`ERROR:\n${output || error.message}`);
                outputChannel.show(); // Make the Output panel visible
                resolve({ success: false, output: output || error.message });
            } else {
                // Command succeeded
                outputChannel.appendLine(output || "(no output)");
                outputChannel.show();
                resolve({ success: true, output: output || "(no output)" });
            }

            // Blank line for readability between commands
            outputChannel.appendLine("");
        });
    });
}
