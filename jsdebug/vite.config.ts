import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: 'https://<USERNAME>.github.io/<REPO_NAME>/', // Replace <USERNAME> and <REPO_NAME> with your GitHub username and repository name
});