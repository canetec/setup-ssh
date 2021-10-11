const os = require("os");
const fs = require("fs");
const core = require("@actions/core");
const execa = require("execa");

const fileIncludesString = (file, string) => {
  if (!fs.existsSync(file)) {
    return false;
  }

  const fileData = fs.readFileSync(file);

  return fileData && fileData.includes(string);
};

const setUpSSH = async ({ disableHostKeyChecking, knownHosts, privateKey }) => {
  const home = process.env.HOME;
  const sshHome = `${home}/.ssh`;
  fs.mkdirSync(sshHome, { recursive: true });

  const authSock = "/tmp/ssh-auth.sock";
  core.exportVariable("SSH_AUTH_SOCK", authSock);

  if (fs.existsSync(authSock)) {
    core.info("Skipping SSH agent setup as agent is already running.");
    return;
  }

  await execa("ssh-agent", ["-a", authSock]);

  const fixedPrivateKey = `${privateKey.replace("/\r/g", "").trim()}\n`;
  await execa("ssh-add", ["-"], { input: fixedPrivateKey });

  if (disableHostKeyChecking) {
    const sshConfigFileLocation = `${sshHome}/config`;
    const strictHostKeyCheckingNo = "StrictHostKeyChecking no";
    const isStrictHostKeyCheckingNoAlreadyAppended = await fileIncludesString(
      sshConfigFileLocation,
      strictHostKeyCheckingNo
    );
    if (!isStrictHostKeyCheckingNoAlreadyAppended) {
      await fs.appendFileSync(
        sshConfigFileLocation,
        os.EOL + strictHostKeyCheckingNo
      );
    }

    return;
  }

  const knownHostsFileLocation = `${sshHome}/known_hosts`;
  const isHostAlreadyAppended = await fileIncludesString(
    knownHostsFileLocation,
    knownHosts
  );

  if (!isHostAlreadyAppended) {
    await fs.appendFileSync(knownHostsFileLocation, os.EOL + knownHosts);
    await fs.chmodSync(knownHostsFileLocation, "644");
  }
};

setUpSSH({
  disableHostKeyChecking: core.getInput("ssh-disable-host-key-checking"),
  knownHosts: core.getInput("ssh-known-hosts"),
  privateKey: core.getInput("ssh-private-key"),
});
