const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../private/.env') });

const fs = require("fs");
const axios = require("axios");
const simpleGit = require("simple-git");

const GITHUB_USERNAME = "fepocodes";
const GITHUB_TOKEN = process.env['Github_Token']
const REPOS_DIR = path.join(__dirname, "../");

async function createRepoOnGitHub(repoName) {
    try {
        const res = await axios.post(
            "https://api.github.com/user/repos",
            {
                name: repoName,
                private: false,
                auto_init: false
            },
            {
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                    Accept: "application/vnd.github+json",
                },
            }
        );
        console.log(`✅ GitHub repo created: ${res.data.full_name}`);
        return res.data.clone_url;
    } catch (err) {
        if (err.response?.status === 422) {
            //console.log(`⚠️ Repo ${repoName} already exists on GitHub.`);
            return `https://github.com/${GITHUB_USERNAME}/${repoName}.git`;
        } else {
            throw err;
        }
    }
}

async function processRepo(dirName) {
    const repoPath = path.join(REPOS_DIR, dirName);
    const git = simpleGit(repoPath);
    let remoteUrl

    try {
        remoteUrl = await createRepoOnGitHub(dirName);
        await git.init();
        await git.addRemote("origin", remoteUrl);
    } catch { }

    try {
        await git.raw(["rm", "-r", "--cached", "."]);
    } catch { }

    const status = await git.status();

    if (status.not_added.length || status.modified.length || status.deleted.length) {
        await git.add(".");
        await git.commit("🔄 Auto commit changes");
        try {
            await git.push("origin", "master");
        } catch (err) {
            if (err.message.includes("refspec") || err.message.includes("rejected")) {
                console.log(`🧹 Repo broken (${dirName}), resetting...`);
                fs.rmSync(path.join(repoPath, ".git"), { recursive: true, force: true });

                const fresh = simpleGit(repoPath);
                remoteUrl = await createRepoOnGitHub(dirName);
                await fresh.init();
                await fresh.addRemote("origin", remoteUrl);
                await fresh.add(".");
                await fresh.commit("🚀 Clean reset push");
                await fresh.push("origin", "master", ["--force"]);
                console.log(`✅ ${dirName} reset and pushed cleanly.`);
                return;
            } else {
                throw err;
            }
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

    console.log("🎉 All repositories processed.");
}

main();
