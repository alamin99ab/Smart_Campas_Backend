/**
 * Script to replace console.log/error with logger
 * Run: node scripts/replace-console.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const directories = ['controllers', 'middleware', 'utils', 'models'];
const filesToSkip = ['logger.js'];

function replaceConsoleInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace console.error with logger.error
    if (content.includes('console.error')) {
        // Add logger require if not present
        if (!content.includes("require('./utils/logger')") && !content.includes("require('../utils/logger')")) {
            const requireMatch = content.match(/^const\s+\w+\s*=\s*require\(/m);
            if (requireMatch) {
                const insertPos = content.indexOf(requireMatch[0]);
                const lineEnd = content.indexOf('\n', insertPos);
                content = content.slice(0, lineEnd + 1) + 
                    "const logger = require('../utils/logger');\n" + 
                    content.slice(lineEnd + 1);
                modified = true;
            }
        }

        // Replace console.error patterns
        content = content.replace(/console\.error\(([^)]+)\)/g, (match, args) => {
            modified = true;
            // Handle different argument patterns
            if (args.includes(':')) {
                // Pattern: console.error('Message:', error)
                return `logger.error(${args})`;
            } else {
                // Pattern: console.error(error)
                return `logger.error(${args})`;
            }
        });
    }

    // Replace console.log with logger.info (only in non-production code)
    if (content.includes('console.log')) {
        if (!content.includes("require('./utils/logger')") && !content.includes("require('../utils/logger')")) {
            const requireMatch = content.match(/^const\s+\w+\s*=\s*require\(/m);
            if (requireMatch) {
                const insertPos = content.indexOf(requireMatch[0]);
                const lineEnd = content.indexOf('\n', insertPos);
                content = content.slice(0, lineEnd + 1) + 
                    "const logger = require('../utils/logger');\n" + 
                    content.slice(lineEnd + 1);
                modified = true;
            }
        }

        // Replace console.log with logger.info
        content = content.replace(/console\.log\(([^)]+)\)/g, (match, args) => {
            modified = true;
            return `logger.info(${args})`;
        });
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
        return true;
    }
    return false;
}

function processDirectory(dir) {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
        console.log(`Directory not found: ${fullPath}`);
        return;
    }

    const files = fs.readdirSync(fullPath);
    files.forEach(file => {
        if (filesToSkip.includes(file)) return;
        
        const filePath = path.join(fullPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile() && file.endsWith('.js')) {
            replaceConsoleInFile(filePath);
        }
    });
}

console.log('Replacing console statements with logger...\n');
directories.forEach(dir => processDirectory(dir));
console.log('\nDone!');
