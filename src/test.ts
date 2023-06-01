import {getGoogleOauthToken, listDocuments} from "./admin";
import {buildCollectionViewFromFirestoreResults} from "./schema_builder";
import JSON5 from "json5";

import util from "util";

getGoogleOauthToken().then(async (token) => {
    let projectId = "firecms-demo-27150";
    let collectionId = "dadaki";
    // const res = await hasGoogleAuthEnabled(token, projectId);
    // const config = await getWebappConfig(token, projectId, "1:837544933711:web:e65ca96f1cf2fadd01ad3a");
    // console.log(config);


    // const res = await listDocuments(token, projectId, "users");
    // console.log(res.data.documents);
    // const res = await createWebapp(token, projectId, "Test CMS");
    // console.log(res);

    // await initFirebaseAdmin(token, projectId);
    // const util = require('util');
    // getEntityProperties("users").then((res) => console.log(util.inspect(res, false, null, true)));

    // const res = await createServiceAccount(token, projectId);
    // console.log(res);

    // const operationId = await createWebapp(token, projectId, "bbb");
    // // console.log(operationId);
    // const webapp = await getOperation(token, operationId);
    // // console.log(webapp);
    // const config = await getWebappConfig(token, projectId, webapp.response.appId);
    // // console.log(config);
    // const documents = await listDocuments(config, "users");
    // console.log(documents);
    // const schema = buildSchemaForObjects(documents);

    const documents = await listDocuments(token, projectId, collectionId);
    const schema = await buildCollectionViewFromFirestoreResults(documents, collectionId);
    console.log(JSON5.stringify(schema, null, '\t'));
});
