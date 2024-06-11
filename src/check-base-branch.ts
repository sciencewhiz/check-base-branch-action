import * as core from "@actions/core";
import * as github from "@actions/github";

const getPRNumber = (): number | undefined => {
  const pr = github.context.payload.pull_request;

  if (pr) {
    return pr.number;
  }
};

const getProtectedBranches = (): string[] => {
  const branches = core.getInput("protected-branches", { required: true });

  return branches.split(',').map(b => b.trim());
}

async function run() {
  const prNumber = getPRNumber();

  if (!prNumber) {
    core.debug("Could not get pull request number from context. Skipping.");
    return;
  }

  try {
    const token = core.getInput("repo-token", { required: true });
    const protectedBranches = getProtectedBranches();
    const updateBranch = core.getInput("update-branch");
    const defaultBranch = core.getInput("default-branch", { required: updateBranch !== 'true' });

    const oktokit = github.getOctokit(token);

    core.debug(`Checking base branch for PR #${prNumber}`);

    const payload = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber
    };

    const pr = await oktokit.pulls.get({
      ...payload
    });

    if (protectedBranches.includes(pr.data.base.ref)) {
      if (updateBranch === 'true') {
        core.debug(`Updating base branch '${pr.data.base.ref}' to '${defaultBranch}'.`);

        await oktokit.pulls.update({
          ...payload,
          base: defaultBranch
        });

        core.info(`Branch updated from '${pr.data.base.ref}' to '${defaultBranch}'.`)
      } else {
        core.setFailed(`Base branch set to protected branch '${pr.data.base.ref}'`);
        return;
      }
    } else {
      core.debug(`Base branch is ${pr.data.base.ref}. Skipping.`);
    }
  } catch (err) {
    if (typeof err === "string") {
        core.error(err);
        core.setFailed(`Error occurred while validating base branch: ${err}`);
    } else if (err instanceof Error) {
        core.error(err);
        core.setFailed(`Error occurred while validating base branch: ${err.message}`);
    }
  }
}

run();
