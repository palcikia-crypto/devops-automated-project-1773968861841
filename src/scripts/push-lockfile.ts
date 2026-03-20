import { execSync } from 'child_process';
import path from 'path';

const token = process.env.GH_TOKEN;
const projectDir = path.join(process.cwd(), 'devops-project');

try {
  console.log('Generating package-lock.json...');
  execSync('npm install --package-lock-only', { cwd: projectDir });
  
  console.log('Pushing lock file to GitHub...');
  execSync('git add package-lock.json', { cwd: projectDir });
  execSync('git commit -m "Add package-lock.json for GitHub Actions cache"', { cwd: projectDir });
  
  const remoteUrl = execSync('git remote get-url origin', { cwd: projectDir }).toString().trim();
  const authenticatedUrl = remoteUrl.replace('https://', `https://${token}@`);
  
  execSync(`git push ${authenticatedUrl} master`, { cwd: projectDir, stdio: 'inherit' });
  console.log('SUCCESS: Lock file pushed to GitHub!');
} catch (error: any) {
  console.error('FAILED: ' + error.message);
  process.exit(1);
}
