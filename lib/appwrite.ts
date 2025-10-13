import { Account, Client, Databases, Storage } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;

const appwriteClient = new Client();

if (endpoint) {
  appwriteClient.setEndpoint(endpoint);
}

if (project) {
  appwriteClient.setProject(project);
}

export { appwriteClient };

export const appwriteAccount = new Account(appwriteClient);
export const appwriteDatabases = new Databases(appwriteClient);
export const appwriteStorage = new Storage(appwriteClient);

function assertAppwriteConfig() {
  if (!endpoint || !project) {
    throw new Error(
      "Appwrite client misconfigured: NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT must be defined"
    );
  }
}

export async function ensureAppwriteSession() {
  assertAppwriteConfig();
  await appwriteAccount.get();
}
