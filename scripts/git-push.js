const git = require("isomorphic-git");
const fs = require("fs");
const path = require("path");
const http = require("isomorphic-git/http/node");

const dir = path.join(__dirname, "..");

async function run() {
  try {
    const statusMatrix = await git.statusMatrix({ fs, dir });
    for (const row of statusMatrix) {
      const filepath = row[0];
      const headStatus = row[1];
      const workdirStatus = row[2];
      
      if (headStatus !== workdirStatus) {
        if (workdirStatus === 0) {
          await git.remove({ fs, dir, filepath });
          console.log("Removed", filepath);
        } else {
          await git.add({ fs, dir, filepath });
          console.log("Added", filepath);
        }
      }
    }
    const sha = await git.commit({
      fs,
      dir,
      author: { name: "AI Agent", email: "ai@example.com" },
      message: "Fix Studio KI integration for web and patch custom fetch"
    });
    console.log("Committed", sha);
    console.log("Pushing to GitHub...");
    const res = await git.push({
      fs,
      http,
      dir,
      remote: "origin",
      ref: "main",
      onAuth: () => ({ username: process.env.GITHUB_TOKEN || "" })
    });
    console.log("Pushed successfully!", res);
  } catch (err) {
    console.error("Git error:", err);
  }
}
run();
