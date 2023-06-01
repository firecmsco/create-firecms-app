import React from "react";
import ReactDOM from "react-dom";
import {Authenticator, CMSApp} from "@camberi/firecms";
import {User} from "firebase/app";

import "./index.css";
import logo from "./images/undraw_website_builder_bxki.svg";
import * as serviceWorker from "./serviceWorker";
import {firebaseConfig} from "./firebase_config";
import {navigation} from "./site_config";

const myAuthenticator: Authenticator = (user?: User) => {
    console.log("Allowing access to", user?.email);
    return true;
};

ReactDOM.render(
    <CMSApp
        name={"FireCMS"}
        authentication={myAuthenticator}
        logo={logo}
        navigation={navigation}
        firebaseConfig={firebaseConfig}
    />,
    document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.register();
serviceWorker.unregister();
