const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log("========================================");
console.log("=== AUTOMATYCZNY STRAZNIK PACZKI MODOW ===");
console.log("========================================");
console.log("Pilnuje Twojego folderu na Pulpicie... Wrzuć lub usuń moda,");
console.log("a system sam wygeneruje manifest i zaktualizuje launcher u znajomych!\n");

function getGitPath() {
    const appDataLocal = process.env.LOCALAPPDATA;
    if (appDataLocal) {
        const ghDesktopDir = path.join(appDataLocal, 'GitHubDesktop');
        if (fs.existsSync(ghDesktopDir)) {
            const appDirs = fs.readdirSync(ghDesktopDir).filter(f => f.startsWith('app-'));
            if (appDirs.length > 0) {
                // Sortujemy od najnowszej wersji aplikacji
                appDirs.sort().reverse();
                // !!! POPRAWKA KRYTYCZNA: Pobieramy konkretny, pierwszy element tablicy jako string [0] !!!
                const fullGitPath = path.join(ghDesktopDir, appDirs[0], 'resources', 'app', 'git', 'cmd', 'git.exe');
                if (fs.existsSync(fullGitPath)) {
                    return `"${fullGitPath}"`;
                }
            }
        }
    }
    return 'git';
}

const gitCmd = getGitPath();

function generujManifest() {
    console.log("[STRAZNIK]: Wykryto zmiany! Generowanie nowej mapy manifest.json...");
    const modsDir = path.join(__dirname, 'mods');
    const manifestPath = path.join(__dirname, 'manifest.json');
    
    if (!fs.existsSync(modsDir)) return;
    
    const manifest = { files: {} };
    const files = fs.readdirSync(modsDir);
    
    files.forEach((file) => {
        if (file.endsWith('.jar')) {
            const filePath = path.join(modsDir, file);
            const fileData = fs.readFileSync(filePath);
            const hash = crypto.createHash('sha256').update(fileData).digest('hex').toLowerCase();
            manifest.files[`mods/${file}`] = hash;
        }
    });
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');
    console.log("[STRAZNIK]: Nowy plik manifest.json jest gotowy na dysku.");
}

function wyslijNaGitHub() {
    try {
        console.log("[GITHUB]: Rozpoczynanie automatycznego wypychania plikow do chmury...");
        
        execSync(`${gitCmd} add .`, { cwd: __dirname });
        execSync(`${gitCmd} commit -m "Automatyczna aktualizacja paczki przez straznika"`, { cwd: __dirname });
        
        console.log("[GITHUB]: Wymuszanie aktualizacji serwera (force push)...");
        execSync(`${gitCmd} push origin main --force`, { cwd: __dirname, stdio: 'ignore' });
        
        console.log("\n=== [SUKCES]: Zmiany sa juz aktywne w sieci! Znajomi moga pobierac nowosci. ===\n");
    } catch (err) {
        console.log("[GITHUB]: Wystąpił nieoczekiwany problem przy wysyłaniu plików.\n");
    }
}

let debounceTimer;
fs.watch(path.join(__dirname, 'mods'), (eventType, filename) => {
    if (filename && filename.endsWith('.jar')) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            generujManifest();
            wyslijNaGitHub();
        }, 2000);
    }
});
