import arg from 'arg';
import {createProject} from "./main";
import inquirer from "inquirer";
import {getGoogleOauthToken, listProjects} from "./admin";
import {CMSAppProps} from "@camberi/firecms";
import chalk from "chalk";

export type CLIOptions = Partial<{
    skipPrompts: boolean;
    git: boolean;
    dir_name: string;

    targetDirectory: string;
    templateDirectory: string;

    skipInstall: boolean;
    skipFirebaseSetup: boolean;
    skipWebappSetup: boolean;

    authToken?: string;
    firebaseProject?: string;
    createWebapp?: boolean;
    webappName?: string;

    siteSchema?: CMSAppProps;
    inferCollections?: string[]
    inferringCollectionsFinished?: boolean
}>

function parseArgumentsIntoOptions(rawArgs): CLIOptions {
    const args = arg(
        {
            '--git': Boolean,
            '--yes': Boolean,
            '--skipFirebaseSetup': Boolean,
            '--skipWebappSetup': Boolean,
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
        skipFirebaseSetup: args['--skipFirebaseSetup'] || false,
        skipWebappSetup: args['--skipWebappSetup'] || false,
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


async function promptForFirebaseProjectList(options: CLIOptions): Promise<CLIOptions> {

    const projects = await listProjects(options.authToken);

    if (options.skipFirebaseSetup) {
        return {
            ...options,
            authToken: null,
            firebaseProject: null,
        };
    }

    const questions = [];
    questions.push({
        type: 'list',
        name: 'firebaseProject',
        message: 'Please choose which Firebase project to use',
        choices: projects.map(p => p.projectId)
    });

    const answers = await inquirer.prompt(questions);
    return {
        ...options,
        firebaseProject: answers.firebaseProject
    };
}


async function promptForFirebaseAuth(options: CLIOptions): Promise<CLIOptions> {

    if (options.skipFirebaseSetup) {
        return {
            ...options,
        };
    }

    const questions = [];
    questions.push({
        type: 'confirm',
        name: 'authWithFirebase',
        message: 'Would you like to connect this CLI with your existing Firebase project for a smoother setup?',
        default: true
    });

    const answers = await inquirer.prompt(questions);
    let authToken: string;
    if (answers.authWithFirebase) {
        console.log("Please complete the auth process in the browser and then continue here");
        try {
            authToken = await getGoogleOauthToken();
        } catch (e) {
            console.error('%s Failed to retrieve OAuth token from Google', chalk.red.bold('ERROR'));
            process.exit(2);
        }
    }

    return {
        authToken,
        ...options,
    };
}

async function promptForCreatingWebapp(options: CLIOptions): Promise<CLIOptions> {

    if (options.skipFirebaseSetup || !options.authToken || !options.firebaseProject) {
        return {
            ...options,
            createWebapp: false,
            webappName: null,
        };
    }

    const questions = [];
    questions.push({
        type: 'confirm',
        name: 'createWebapp',
        message: 'Would you like to set up a Webapp in your Firebase project associated with FireCMS?',
        default: true
    }, {
        type: 'input',
        name: 'webappName',
        message: 'Pick a name for the FireCMS webapp in Firebase',
        default: "FireCMS webapp",
        when: (answers) => answers.createWebapp
    });

    const answers = await inquirer.prompt(questions);

    return {
        ...options,
        createWebapp: answers.createWebapp,
        webappName: answers.webappName
    };
}

async function promptForInferringCollection(options: CLIOptions): Promise<CLIOptions> {

    if (options.skipFirebaseSetup || !options.authToken || !options.firebaseProject) {
        return {
            ...options,
            inferringCollectionsFinished: true,
        };
    }

    const questions = [];
    questions.push({
        type: 'confirm',
        name: 'inferSchema',
        message: 'Would you like to infer a new entity schema?',
        default: true
    }, {
        type: 'input',
        name: 'collectionName',
        message: 'Select the collection path',
        when: (answers) => answers.inferSchema
    });

    const answers = await inquirer.prompt(questions);

    let collections = options?.inferCollections ?? [];
    if(answers.collectionName)
        collections = [...collections, answers.collectionName]
    return {
        ...options,
        inferCollections: collections,
        inferringCollectionsFinished: !answers.inferSchema
    };
}


export async function cli(args) {

    let options = parseArgumentsIntoOptions(args);
    options = await promptForFirebaseAuth(options);
    if (options.authToken) {
        options = await promptForFirebaseProjectList(options);
    }

    options = await promptForMissingOptions(options);
    options = await promptForCreatingWebapp(options);

    while (!options.inferringCollectionsFinished) {
        options = await promptForInferringCollection(options);
    }

    await createProject(options);
}
