import arg from 'arg';
import { createProject } from "./main";
import inquirer from "inquirer";

export type CLIOptions = Partial<{
    skipPrompts: boolean;
    git: boolean;
    dir_name: string;

    targetDirectory: string;
    templateDirectory: string;

    skipInstall: boolean;

    authToken?: string;
    firebaseProject?: string;

}>

function parseArgumentsIntoOptions(rawArgs): CLIOptions {
    const args = arg(
        {
            '--git': Boolean,
            '--yes': Boolean,
            '--skipInstall': Boolean,
        },
        {
            argv: rawArgs.slice(2),
        }
    );
    return {
        skipPrompts: args['--yes'] || false,
        git: args['--git'] || false,
        dir_name: args._[0],
        skipInstall: args['--skipInstall'] || false,
    };
}

async function promptForMissingOptions(options: CLIOptions): Promise<CLIOptions> {
    const defaultName = 'my-cms';
    if (options.skipPrompts) {
        return {
            ...options,
            dir_name: options.dir_name || defaultName,
        };
    }

    const questions = [];
    if (!options.dir_name) {
        questions.push({
            type: 'input',
            name: 'dir_name',
            message: 'Please choose which folder to use',
            default: defaultName,
        });
    }

    if (!options.git) {
        questions.push({
            type: 'confirm',
            name: 'git',
            message: 'Initialize a git repository?',
            default: false,
        });
    }

    const answers = await inquirer.prompt(questions);
    return {
        ...options,
        dir_name: options.dir_name || answers.dir_name,
        git: options.git || answers.git,
    };
}

export async function cli(args) {

    let options = parseArgumentsIntoOptions(args);

    options = await promptForMissingOptions(options);

    await createProject(options);
}
