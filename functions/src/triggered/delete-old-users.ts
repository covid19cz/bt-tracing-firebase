import * as admin from "firebase-admin";
import {buildCloudFunction} from "../settings";
import {FIREBASE_AUTH_CLIENT} from "../lib/database";
import ListUsersResult = admin.auth.ListUsersResult;

const MAX_USER_LIFETIME_MS = 1000 * 3600 * 24 * 30 * 6;

async function deleteOldUsers() {
    let pageToken: string | undefined = undefined;
    const cutDay = new Date(new Date().getTime() - MAX_USER_LIFETIME_MS);
    console.log(`Users and all their assets created before ${cutDay} will be deleted accordingly to the service terms & conditions`);
    while (true) {
        const users: ListUsersResult = await FIREBASE_AUTH_CLIENT.listUsers(1000, pageToken);
        for (const user of users.users) {
            const creationDate = new Date(user.metadata.creationTime);
            if (creationDate < cutDay) {
                try {
                    console.log(`Deleting user ${user.uid} created at ${creationDate}`);
                    await FIREBASE_AUTH_CLIENT.deleteUser(user.uid);
                }
                catch (error) {
                    console.error(`User ${user.uid} removal failed: ${error}`);
                }
            }
        }

        if (users.pageToken) {
            pageToken = users.pageToken;
        } else break;
    }
}

export const deleteOldUsersCron = buildCloudFunction({timeoutSeconds: 540}).pubsub
    .schedule("0 3 * * *")
    .timeZone("Europe/Prague")
    .onRun(async (context) => {
        await deleteOldUsers();
    });
