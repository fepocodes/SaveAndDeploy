const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../private/.env') });

const fs = require("fs");
const axios = require("axios");
const simpleGit = require("simple-git");

// Credentials
const GITHUB_USERNAME = "fepocodes";
const GITLAB_USERNAME = "fepocodes";
const BITBUCKET_USERNAME = "fepocodes-admin";

const GITHUB_TOKEN = process.env['Github_Token'];
const GITLAB_TOKEN = process.env['Gitlab_Token'];
const BITBUCKET_TOKEN = process.env['Bitbucket_Token'];

const REPOS_DIR = path.join(__dirname, "../");

// GitHub
async function createRepoOnGitHub(repoName) {
    // implementation...
}

// GitLab
async function createRepoOnGitLab(repoName) {
    // implementation...
}

// Bitbucket
async function createRepoOnBitbucket(repoName) {
    const url = `https://api.bitbucket.org/2.0/repositories/${BITBUCKET_USERNAME}/${repoName}`;
    try {
        const res = await axios.post(
            url,
            { scm: 'git', is_private: false },
            {
                auth: {
                    username: BITBUCKET_USERNAME,
                    password: BITBUCKET_TOKEN
                }
            }
        );
        console.log(`✅ Bitbucket repo created: ${res.data.full_name}`);
        return res.data.links.clone.find(link => link.name === 'https').href;
    } catch (err) {
        if (err.response?.status === 400 || err.response?.status === 409) {
            console.log(`⚠️ Repo ${repoName} already exists on Bitbucket.`);
            return `https://bitbucket.org/${BITBUCKET_USERNAME}/${repoName}.git`;
        } else {
            throw err;
        }
    }
}

async function processRepo(dirName) {
    const repoPath = path.join(REPOS_DIR, dirName);
    const git = simpleGit(repoPath);
    let bitbucketUrl; //, gitlabUrl, githubUrl;

    try {
        // Commented out GitHub and GitLab for testing Bitbucket only
        // gitlabUrl = await createRepoOnGitLab(dirName);
        // githubUrl = await createRepoOnGitHub(dirName);

        bitbucketUrl = await createRepoOnBitbucket(dirName);

        await git.init();

        const remotes = await git.getRemotes(true);

        if (!remotes.find(r => r.name === "origin" || r.name === "bitbucket")) {
            await git.addRemote("bitbucket", bitbucketUrl);
        }

        const remotesNow = await git.getRemotes(true);
        console.log(`🔗 Remotes for ${dirName}:`, remotesNow.map(r => r.name).join(", "));
    } catch (e) {
        console.error(`❌ Error setting up remotes for ${dirName}:`, e.message);
    }

    try {
        await git.raw(["rm", "-r", "--cached", "."]);
    } catch { }

    const status = await git.status();

    if (status.not_added.length || status.modified.length || status.deleted.length) {
        await git.add(".");
        await git.commit("🔄 Auto commit changes");
        try {
            await git.push("bitbucket", "master");
            // await git.push("gitlab", "master");
            // await git.push("github", "master");
        } catch (err) {
            console.error(`❌ Failed to push ${dirName}:`, err.message);
        }
        console.log(`🚀 Changes pushed for ${dirName}`);
    } else {
        console.log(`✅ ${dirName} is up to date. No changes to commit.`);
    }
}

async function main() {
    const allDirs = fs.readdirSync(REPOS_DIR).filter(f =>
        fs.statSync(path.join(REPOS_DIR, f)).isDirectory()
    );

    for (const dir of allDirs) {
        try {
            await processRepo(dir);
        } catch (e) {
            console.error(`❌ Error for ${dir}:`, e.message);
        }
    }

    console.log("🎉 All repositories processed on Bitbucket.");
}

main();
