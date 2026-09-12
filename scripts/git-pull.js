const git = require("isomorphic-git");
const fs = require("fs");
const path = require("path");
const http = require("isomorphic-git/http/node");

const dir = path.join(__dirname, "..");

async function run() {
  try {
    console.log("Pulling from GitHub...");
    await git.pull({
      fs,
      http,
      dir,
      remote: "origin",
      ref: "main",
      author: { name: "AI Agent", email: "ai@example.com" }
    });
    console.log("Pulled successfully!");
  } catch (err) {
    console.error("Git error:", err);
  }
}
run();
