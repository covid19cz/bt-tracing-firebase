import * as admin from "firebase-admin";
import {createUserCallable} from "./endpoints/create-user";
import {deleteUserCallable, deleteUserDataTrigger} from "./endpoints/delete-user";
import {deleteUploadsCallable} from "./endpoints/delete-uploads";

// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

export {createUserCallable as createUser};
export {deleteUserCallable as deleteUser, deleteUserDataTrigger};
export {deleteUploadsCallable as deleteUploads};
