const { series, src, dest } = require('gulp');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const archiver = require('archiver');
const argv = require('yargs').argv;

async function clean() {
    const name = path.basename(path.resolve('.'));
    const files = [];

    files.push(
        'assets',
        'lang',
        'packs',
        'scripts',
        'styles',
        'templates',
        'CHANGELOG.md',
        'module.json'
    );

    // If the project uses SASS
    if (
        fs.existsSync(path.join('src', `${name}.scss`))
    ) {
        files.push('fonts', `${name}.css`);
    }

    console.log(' ', chalk.yellow('Files to clean:'));
    console.log('   ', chalk.blueBright(files.join('\n    ')));

    // Attempt to remove the files
    try {
        for (const filePath of files) {
            await fs.remove(path.join('dist', filePath));
        }
        return Promise.resolve();
    } catch (err) {
        Promise.reject(err);
    }
}

function getManifest() {
    const json = {};

    if (fs.existsSync('src')) {
        json.root = 'src';
    } else {
        json.root = 'dist';
    }

    const modulePath = path.join(json.root, 'module.json');

    if (fs.existsSync(modulePath)) {
        json.file = fs.readJSONSync(modulePath);
        json.name = 'module.json';
    } else {
        return;
    }

    return json;
}

// Link build to User Data folder
async function linkUserData() {
    const packageJson = fs.readJSONSync('package.json');
    const name = path.basename(path.resolve(packageJson.name));
    const config = fs.readJSONSync('foundryconfig.json');

    let destDir;
    try {
        if (
            fs.existsSync(path.resolve('module.json'))
        ) {
            destDir = 'modules';
        } else {
            throw Error(
                `Could not find ${chalk.blueBright(
                    'module.json'
                )} or ${chalk.blueBright('system.json')}`
            );
        }

        let linkDir;
        if (config.dataPath) {
            if (!fs.existsSync(path.join(config.dataPath, 'Data')))
                throw Error('User Data path invalid, no Data directory found');

            linkDir = path.join(config.dataPath, 'Data', destDir, name);
        } else {
            throw Error('No User Data path defined in foundryconfig.json');
        }

        if (argv.clean || argv.c) {
            console.log(
                chalk.yellow(`Removing build in ${chalk.blueBright(linkDir)}`)
            );

            await fs.remove(linkDir);
        } else if (!fs.existsSync(linkDir)) {
            console.log(
                chalk.green(`Copying build to ${chalk.blueBright(linkDir)}`)
            );
            await fs.symlink(path.resolve('.'), linkDir);
        }
        return Promise.resolve();
    } catch (err) {
        Promise.reject(err);
    }
}

async function packageBuild() {
    const manifest = getManifest();

    return new Promise((resolve, reject) => {
        try {
            // Remove the package dir without doing anything else
            if (argv.clean || argv.c) {
                console.log(chalk.yellow('Removing all packaged files'));
                fs.removeSync('package');
                return;
            }

            // Ensure there is a directory to hold all the packaged versions
            fs.ensureDirSync('package');

            // Initialize the zip file
            const zipName = `${manifest.file.id}-${manifest.file.version}.zip`;
            const zipFile = fs.createWriteStream(path.join('package', zipName));
            const zip = archiver('zip', { zlib: { level: 9 } });

            zipFile.on('close', () => {
                console.log(chalk.green(zip.pointer() + ' total bytes'));
                console.log(
                    chalk.green(`Zip file ${zipName} has been written`)
                );
                return resolve();
            });

            zip.on('error', (err) => {
                throw err;
            });

            zip.pipe(zipFile);

            // Add the directory with the final code
            zip.directory('dist/', manifest.file.id);

            zip.finalize();
            src(['dist/module.json']).pipe(dest('package'));
        } catch (err) {
            return reject(err);
        }
    });
}

exports.build = series(
    clean,
);
exports.clean = clean;
exports.link = linkUserData;
exports.package = series(
    clean,
    packageBuild
);
