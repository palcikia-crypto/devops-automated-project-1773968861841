import { execSync } from 'child_process';

const token = process.env.GH_TOKEN;
const repo = 'palcikia-crypto/devops-automated-project-1773968861841';

try {
  console.log('Triggering GitHub Action workflow...');
  execSync(`GH_TOKEN=${token} gh workflow run test.yml --repo ${repo}`, { stdio: 'inherit' });
  
  console.log('Waiting for workflow to start...');
  // Wait a bit for the run to appear
  let runFound = false;
  for (let i = 0; i < 5; i++) {
    const runs = execSync(`GH_TOKEN=${token} gh run list --repo ${repo} --limit 1`).toString();
    if (runs.includes('Node.js CI')) {
      console.log('Workflow run found:');
      console.log(runs);
      runFound = true;
      break;
    }
    console.log('Run not found yet, retrying in 5s...');
    execSync('sleep 5');
  }
  
  if (!runFound) {
    console.log('Workflow run did not appear in time.');
  }
} catch (error: any) {
  console.error('FAILED: ' + error.message);
  process.exit(1);
}
