import fs from "fs";
import http from "http";
import opn from "opn";
import path from 'path';

import {google} from "googleapis";

/**
 * Get Google Oauth access token by starting a server
 * @return {Promise<string>}
 */
export function getGoogleOauthToken(): Promise<string> {
    return new Promise((async (resolve, reject) => {

        const connection = http.createServer(function (req, res) {
            if (req.url.includes("result")) {
                const accessToken = req.url.replace("/result/", "");
                res.end();
                connection.close();
                req.connection.end();
                req.connection.destroy();
                resolve(accessToken);
            } else if (req.url.includes("error")) {
                res.end();
                reject();
                req.connection.end();
                req.connection.destroy();
                connection.close();
            } else {
                fs.readFile(path.join(__dirname, "/../auth/index.html"),
                    function (err, data) {
                        if (err) {
                            res.writeHead(404);
                            res.end(JSON.stringify(err));
                            return;
                        }
                        res.writeHead(200);
                        res.end(data);
                    });
            }
        }).listen(5000);

        opn('http://localhost:5000');

    }));
}

export async function createServiceAccount(accessToken: string, projectId: string) {
    const iam = google.iam({
        version: "v1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await iam.projects.serviceAccounts.create({
        name: `projects/${projectId}`,
        requestBody: {
            serviceAccount: {
                displayName: "FireCMS CLI integration"
            }
        }
    });
    console.log(result);
    return result.data;
}

export async function listProjects(accessToken: string): Promise<{
    displayName?: string;
    name?: string;
    projectId?: string;
    projectNumber?: string;
    resources?: any;
}[]> {
    const firebase = google.firebase({
        version: "v1beta1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await firebase.projects.list();
    return result.data.results;
}

export async function listDocuments(accessToken: string, projectId: string, collectionId: string): Promise<any> {
    const firebase = google.firestore({
        version: "v1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await firebase.projects.databases.documents.list({
        parent: `projects/${projectId}/databases/(default)/documents`,
        collectionId
    });
    return result.data;
}

/**
 *
 * @param accessToken
 * @param projectId
 * @param displayName
 * @return operationId
 */
export async function createWebapp(accessToken: string, projectId: string, displayName: string): Promise<string> {
    const firebase = google.firebase({
        version: "v1beta1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await firebase.projects.webApps.create({
        parent: `projects/${projectId}`,
        requestBody: {
            displayName: displayName
        }
    },);
    return result.data.name;
}

export async function getOperation(accessToken: string, operationId: string): Promise<{
    done?: boolean;
    error?: any;
    name?: string;
    response?: any;
}> {
    const firebase = google.firebase({
        version: "v1beta1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await firebase.operations.get({
        name: operationId,
    });
    if (result.data.error) {
        throw Error(result.data.error.message);
    }
    if (!result.data.done) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getOperation(accessToken, operationId);
    }
    return result.data;
}

export async function getWebappConfig(accessToken: string, projectId: string, webappId: string): Promise<any & {}> {

    const firebase = google.firebase({
        version: "v1beta1",
        headers: {Authorization: `Bearer ${accessToken}`}
    });
    const result = await firebase.projects.webApps.getConfig({
        "name": `projects/${projectId}/webApps/${webappId}/config`,
    });
    return result.data;
}

