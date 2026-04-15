// Build script to inject environment variables into static HTML files
// This runs during Vercel build process and outputs to ./public
const fs = require('fs');
const path = require('path');

// Load .env file if it exists (for local development)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  console.log('📄 Loading .env file for local development...');
  const envContent = fs.readFileSync(envFile, 'utf8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      if (key && value) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Get environment variables from Vercel build environment or .env
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Warning: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are not set.');
  console.warn('   For local development, create a .env file from .env.example');
  console.warn('   For Vercel, set these in Dashboard → Settings → Environment Variables');
}

// Create output directory
const outputDir = path.join(__dirname, 'public');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('📁 Created public/ directory');
} else {
  // Clean existing public directory
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('🧹 Cleaned public/ directory');
}

// Files to copy (static assets)
const filesToCopy = [
  'styles.css',
  'script.js',
  'admin.js',
  'permits.js',
  'documents.js',
  'auth-guard.js'
];

// HTML files to process
const htmlFiles = ['index.html', 'admin.html', 'permits.html', 'documents.html'];

// Copy static files as-is
filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(outputDir, file);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`📄 Copied ${file}`);
  } else {
    console.warn(`⚠️  File not found: ${file}`);
  }
});

// Process HTML files - inject env vars and copy to public
htmlFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(outputDir, file);

  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(srcPath, 'utf8');

  // Replace the env placeholder with actual values
  const envScript = `<script id="env-script">
      window.__ENV__ = {
        SUPABASE_URL: '${SUPABASE_URL}',
        SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}'
      };
    </script>`;

  // Replace everything between ENV_PLACEHOLDER_START and ENV_PLACEHOLDER_END
  const placeholderRegex = /<!-- ENV_PLACEHOLDER_START -->[\s\S]*?<!-- ENV_PLACEHOLDER_END -->/;
  const replacement = `<!-- ENV_PLACEHOLDER_START -->\n    ${envScript}\n    <!-- ENV_PLACEHOLDER_END -->`;
  content = content.replace(placeholderRegex, replacement);

  fs.writeFileSync(destPath, content, 'utf8');
  console.log(`✅ Injected environment variables into ${file} → public/${file}`);
});

// Copy api directory for serverless functions
const apiSrc = path.join(__dirname, 'api');
const apiDest = path.join(__dirname, 'api'); // API stays at root for Vercel

console.log('✅ Build script completed');
console.log(`   Output directory: ${outputDir}/`);
console.log(`   Files in public: ${fs.readdirSync(outputDir).join(', ')}`);
