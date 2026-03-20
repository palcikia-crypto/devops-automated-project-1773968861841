import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const token = process.env.GH_TOKEN;
const repoName = 'devops-automated-project-' + Date.now();
const projectDir = path.join(process.cwd(), 'devops-project');

console.log('Starting GitHub deployment...');

try {
  // 1. Clean up existing .git if any
  const gitDir = path.join(projectDir, '.git');
  if (fs.existsSync(gitDir)) {
    console.log('Cleaning up existing .git directory...');
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  // 2. Create Repo and Push using gh
  console.log('Creating GitHub repository: ' + repoName);
  // We use --source=. to initialize and push the current directory
  const command = `GH_TOKEN=${token} gh repo create ${repoName} --public --source=. --push`;
  
  // We need to set git config before pushing if gh doesn't do it
  // But gh repo create --source=. will fail if git is not configured
  execSync('git init', { cwd: projectDir });
  execSync('git config user.email "artist2026777@gmail.com"', { cwd: projectDir });
  execSync('git config user.name "DevOps Assistant"', { cwd: projectDir });
  execSync('git add .', { cwd: projectDir });
  execSync('git commit -m "Initial commit from DevOps Assistant"', { cwd: projectDir });

  execSync(command, { cwd: projectDir, stdio: 'inherit' });
  
  console.log('SUCCESS: Project deployed to GitHub!');
} catch (error: any) {
  console.error('FAILED: ' + error.message);
  process.exit(1);
}
