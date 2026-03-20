import { execSync } from 'child_process';
import path from 'path';

const token = process.env.GH_TOKEN;
const projectDir = path.join(process.cwd(), 'devops-project');

try {
  console.log('Pushing updates to GitHub...');
  execSync('git add .', { cwd: projectDir });
  try {
    execSync('git commit -m "Transform to React DevOps AI Assistant website"', { cwd: projectDir });
  } catch (e) {
    console.log('Nothing to commit, proceeding to push...');
  }
  
  // Get the remote URL and inject the token
  const remoteUrl = execSync('git remote get-url origin', { cwd: projectDir }).toString().trim();
  const authenticatedUrl = remoteUrl.replace('https://', `https://${token}@`);
  
  execSync(`git push ${authenticatedUrl} master`, { cwd: projectDir, stdio: 'inherit' });
  console.log('SUCCESS: Updates pushed to GitHub!');
} catch (error: any) {
  console.error('FAILED: ' + error.message);
  process.exit(1);
}
