/**
 * steps.ts — Defines all the walkthrough steps for the Git Helper.
 *
 * Each step represents one Git concept/command that the user will learn.
 * Steps are displayed in order in the sidebar walkthrough panel.
 *
 * WHY A SEPARATE FILE?
 *   Keeping step data separate from the UI logic makes it easy to
 *   add, remove, or reorder steps without touching any other code.
 */

// =============================================================
// Step Interface
// =============================================================

/**
 * Represents a single step in the Git walkthrough.
 */
export interface WalkthroughStep {
    /** Unique identifier for this step (used in HTML element IDs) */
    id: string;

    /** Short title shown as the step heading (e.g., "1. Check Git is Installed") */
    title: string;

    /** Plain-English explanation of what this step does and why */
    description: string;

    /**
     * The command shown to the user in the UI (for display only).
     * This is NOT what gets executed — `args` is used for execution.
     */
    command: string;

    /**
     * The arguments passed to `git` when executing this step.
     * For example, ["status"] runs `git status`.
     *
     * WHY SEPARATE FROM `command`?
     *   We use Node's `execFile` which takes args as an array.
     *   This is safer than building a shell command string because
     *   user input (like commit messages) can't accidentally be
     *   interpreted as shell commands. (Look up "command injection"
     *   if you want to learn more about this security concept!)
     */
    args: string[];

    /**
     * If set, the extension will prompt the user for input before running.
     * The user's input gets appended to the `args` array.
     */
    requiresInput?: {
        /** The prompt text shown in the input box */
        prompt: string;
        /** Placeholder/example text shown in the input box */
        placeholder: string;
    };

    /** Extra tips or notes shown below the command (optional) */
    notes?: string;
}

// =============================================================
// Walkthrough Steps
// =============================================================

/**
 * The ordered list of walkthrough steps.
 * These guide a beginner through their first complete Git workflow:
 *   check install → init → status → stage → commit → remote → push → pull
 */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
    {
        id: "check-git",
        title: "1. Check Git is Installed",
        description:
            "Before we start, let's make sure Git is installed on your computer. " +
            "This command prints the Git version number. If you see a version, you're good to go!",
        command: "git --version",
        args: ["--version"],
    },
    {
        id: "init-repo",
        title: "2. Initialize a Repository",
        description:
            "This creates a new Git repository in your current folder. " +
            "It adds a hidden .git folder that Git uses to track all your changes. " +
            "You only need to do this once per project.",
        command: "git init",
        args: ["init"],
        notes:
            "If your folder is already a Git repo, this is safe to run again — it won't overwrite anything.",
    },
    {
        id: "check-status",
        title: "3. Check Status",
        description:
            "This shows the current state of your repository: which files are new, " +
            "which are modified, and which are staged (ready to commit). " +
            "Get in the habit of running this often!",
        command: "git status",
        args: ["status"],
    },
    {
        id: "make-changes",
        title: "4. Make a File Change",
        description:
            "Before we can stage and commit, we need something to commit! " +
            "Go create or edit a file in your project folder — for example, " +
            "create a file called 'hello.txt' with some text in it. " +
            "When you're ready, click 'Run Step' to check the status and see your changes listed.",
        command: "git status",
        args: ["status"],
        notes:
            "This step runs 'git status' so you can see your new/changed files appear in the output.",
    },
    {
        id: "stage-files",
        title: "5. Stage Your Files",
        description:
            "Staging tells Git which changes you want to include in your next commit. " +
            "Think of it like putting files into a box before sealing it. " +
            "The dot (.) means 'stage everything in the current folder'.",
        command: "git add .",
        args: ["add", "."],
        notes: "You can also stage specific files with 'git add filename.txt'.",
    },
    {
        id: "commit",
        title: "6. Commit Your Changes",
        description:
            "A commit is a saved snapshot of your staged changes. " +
            "Each commit needs a message describing what you changed. " +
            "Good commit messages are short but descriptive, like 'Add homepage layout'.",
        command: 'git commit -m "your message"',
        // The -m flag is here; the user's message gets appended as the next arg.
        // So it becomes: git commit -m "whatever they type"
        args: ["commit", "-m"],
        requiresInput: {
            prompt: "Enter your commit message",
            placeholder: "e.g., Add initial project files",
        },
    },
    {
        id: "add-remote",
        title: "7. Add a Remote (GitHub)",
        description:
            "A 'remote' is a copy of your repo stored online (like on GitHub). " +
            "This command links your local repo to a GitHub repository. " +
            "First, create a new repo on github.com, then paste the URL here.",
        command: "git remote add origin <url>",
        // The URL gets appended, so it becomes: git remote add origin https://...
        args: ["remote", "add", "origin"],
        requiresInput: {
            prompt: "Enter your GitHub repository URL",
            placeholder: "https://github.com/username/my-repo.git",
        },
        notes:
            "Find the URL on your GitHub repo page — click the green 'Code' button and copy the HTTPS link.",
    },
    {
        id: "push",
        title: "8. Push to GitHub",
        description:
            "Push uploads your commits to the remote repository (GitHub). " +
            "The '-u' flag sets 'origin main' as the default, so next time " +
            "you can just type 'git push' without the extra arguments.",
        command: "git push -u origin main",
        args: ["push", "-u", "origin", "main"],
        notes:
            "If your default branch is called 'master' instead of 'main', " +
            "change 'main' to 'master'. Newer Git versions use 'main' by default.",
    },
    {
        id: "pull",
        title: "9. Pull from GitHub",
        description:
            "Pull downloads the latest changes from the remote repository " +
            "and merges them into your local branch. This is how you stay " +
            "up to date with changes made by teammates (or yourself on another computer).",
        command: "git pull",
        args: ["pull"],
        notes: "Always pull before you start working to avoid merge conflicts!",
    },
];
