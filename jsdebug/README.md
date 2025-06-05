# jsdebug

This project is a React application built with TypeScript and Vite. It serves as a demonstration of how to set up a modern web application with these technologies.

## Project Structure

- **public/index.html**: The main HTML file for the application.
- **src/App.tsx**: The root component of the React application.
- **src/main.tsx**: The entry point for rendering the React application.
- **src/vite-env.d.ts**: TypeScript definitions for Vite.
- **src/components/ExampleComponent.tsx**: An example functional component.
- **tsconfig.json**: TypeScript configuration file.
- **package.json**: npm configuration file.
- **vite.config.ts**: Vite configuration file.
- **README.md**: Documentation for the project.

## Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/PaulGibbs3rd/jsdebug.git
   cd jsdebug
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

## Preparing for Deployment to GitHub Pages

To deploy this project to GitHub Pages, follow these steps:

1. **Add a homepage field in `package.json`**:
   Update your `package.json` to include the homepage URL:
   ```json
   "homepage": "https://<username>.github.io/<repository-name>"
   ```

2. **Update `vite.config.ts`**:
   Set the base path for deployment:
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     base: '/<repository-name>/',
   });
   ```

3. **Build the project**:
   Run the build command:
   ```
   npm run build
   ```

4. **Deploy to GitHub Pages**:
   Use a tool like `gh-pages` to deploy the contents of the `dist` folder to the `gh-pages` branch:
   ```
   npx gh-pages -d dist
   ```

## Usage

After deployment, you can access your application at the URL specified in the homepage field of your `package.json`. 

Feel free to explore and modify the components as needed!