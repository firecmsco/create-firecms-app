import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import {promisify} from 'util';
import execa from 'execa';
import Listr from 'listr';
import {projectInstall} from 'pkg-install';
import {
    createWebapp,
    getOperation,
    getWebappConfig,
    listDocuments
} from "./admin";
import {CLIOptions} from "./cli";
import {buildCollectionViewFromFirestoreResults} from "./schema_builder";
import {camelCase} from "./util";
import {EntityCollectionView} from "@camberi/firecms";

import JSON5 from "json5";

const access = promisify(fs.access);
const copy = promisify(ncp);

async function copyTemplateFiles(options: CLIOptions, webappConfig: object, collectionViews: Record<string, EntityCollectionView<any>>) {
    return copy(options.templateDirectory, options.targetDirectory, {
        clobber: false,
    }).then(_ => {
        if (webappConfig) {
            writeWebAppConfig(options, webappConfig);
        }
        if (collectionViews) {
            writeSiteConfig(options, collectionViews);
        }
    });
}

export async function createProject(options: CLIOptions) {

    // @ts-ignore
    const currentFileUrl = import.meta["url"];

    const dir = './' + options.dir_name;
    if (fs.existsSync(dir)) {
        if (fs.readdirSync(dir).length !== 0) {
            console.error('%s Directory is not empty', chalk.red.bold('ERROR'));
            process.exit(1);
        }
    } else {
        fs.mkdirSync(dir);
    }

    const targetDirectory = path.resolve(
        process.cwd(),
        dir
    );

    options = {
        ...options,
        targetDirectory: targetDirectory,
    };

    const templateDir = path.resolve(
        new URL(currentFileUrl).pathname,
        '../../template'
    );
    options.templateDirectory = templateDir;

    try {
        await access(templateDir, fs.constants.R_OK);
    } catch (err) {
        console.error('%s Invalid template name', chalk.red.bold('ERROR'));
        process.exit(1);
    }

    console.log(options);

    const tasks = new Listr([
        {
            title: 'Inferring schema',
            task: (ctx, task) => {
                ctx.collectionViews = {};
                return Promise.all(options.inferCollections.map(async (collectionId) => {
                    const documents = await listDocuments(options.authToken, options.firebaseProject, collectionId);
                    const collectionView = await buildCollectionViewFromFirestoreResults(documents, collectionId);
                    const variableName = camelCase(collectionId);
                    ctx.collectionViews[variableName] = collectionView;
                }));
            },
            skip: () => !options.inferCollections,
        },
        {
            title: 'Initialise webapp in Firebase',
            task: (ctx, task) =>
                createWebapp(options.authToken, options.firebaseProject, options.webappName)
                    .then(operationId => getOperation(options.authToken, operationId))
                    .then(webapp => getWebappConfig(options.authToken, options.firebaseProject, webapp.response.appId))
                    .then(config => ctx.webappConfig = config),
            skip: () => !options.createWebapp,
        },
        {
            title: 'Copy project files',
            task: (ctx) => copyTemplateFiles(options, ctx.webappConfig, ctx.collectionViews),
        },
        {
            title: 'Initialize git',
            task: () => initGit(options),
            enabled: () => options.git,
        },
        {
            title: 'Install dependencies',
            task: () =>
                projectInstall({
                    cwd: options.targetDirectory,
                }),
            skip: () =>
                options.skipInstall
                    ? 'Pass --skipInstall to skip automatically installing dependencies'
                    : undefined,
        },
    ]);

    await tasks.run();

    console.log('%s Project ready', chalk.green.bold('DONE'));
    console.log('');
    console.log('Now you can run:');
    console.log(chalk.bgCyanBright.black.bold('cd ' + options.dir_name));
    if (options.skipInstall)
        console.log(chalk.bgCyanBright.black.bold('yarn install'));
    console.log(chalk.bgCyanBright.black.bold('yarn start'));
    console.log('');
    return true;
}

async function initGit(options: CLIOptions) {
    const result = await execa('git', ['init'], {
        cwd: options.targetDirectory,
    });
    if (result.failed) {
        return Promise.reject(new Error('Failed to initialize git'));
    }
    return;
}


function writeWebAppConfig(options: CLIOptions, webappConfig: object) {
    fs.writeFile(options.targetDirectory + '/src/firebase_config.ts',
        `export const firebaseConfig = ${JSON5.stringify(webappConfig, null, '\t')};`,
        function (err) {
            if (err) return console.log(err);
        });
}

function writeSiteConfig(options: CLIOptions, collectionViews: Record<string, EntityCollectionView<any>>) {


    let data = `
import React from "react";

import {
Entity,
EntityCollectionView,
EnumValues,
buildSchema
} from "@camberi/firecms";

`;

    Object.entries(collectionViews).forEach(([variable, entityCollectionView]) => {
        data += `
const ${variable} = buildSchema(
    ${JSON5.stringify(entityCollectionView.schema, null, '\t')}
);

`
    });


    data += `
export const navigation: EntityCollectionView<any>[] = [
`;

    Object.entries(collectionViews).forEach(([variable, entityCollectionView]) => {
        data += `
    {
        relativePath: ${JSON5.stringify(entityCollectionView.relativePath, null, '\t')},
        schema: ${variable},
        name: ${JSON5.stringify(entityCollectionView.name, null, '\t')},
    },
`;
    });

    data += `
];
`;

    fs.writeFile(options.targetDirectory + '/src/site_config.tsx',
        data, (err) => {
            if (err) return console.log(err);
        });
}