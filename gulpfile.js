const { series, parallel, src, dest, watch } = require('gulp');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const stringify = require('json-stringify-pretty-compact');
const archiver = require('archiver');
const sass = require('gulp-sass')(require('sass'));
const argv = require('yargs').argv;
const flatMap = require('flat-map').default;
const scaleImages = require('gulp-scale-images');

function getConfig() {
    const configPath = path.resolve(process.cwd(), 'foundryconfig.json');
    let config;

    if (fs.existsSync(configPath)) {
        config = fs.readJSONSync(configPath);
        return config;
    } else {
        return;
    }
}

const computeFileName = (output, scale, cb) => {
    const fileName = [
        path.basename(output.path, output.extname),
        scale.format || output.extname
    ].join('.');
    cb(null, fileName);
};

function processImageFile(file, cb) {
    const webpFile = file.clone();
    webpFile.scale = {
        maxHeight: 1080,
        format: 'webp',
        fit: 'inside',
        metadata: false
    };
    cb(null, webpFile);
}

function convertToWebp(cb) {
    src('./src/artwork/**/*.png')
        .pipe(flatMap(processImageFile))
        .pipe(scaleImages(computeFileName))
        .pipe(dest('./src/artwork/'));
    cb();
}

function buildSASS() {
    return src('src/**/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(dest('dist'));
}

function copyFiles() {
    return src(['./src/**', './CHANGELOG.md'])
        .pipe(dest('./dist'));
}

function copyPacks() {
    return src('./dist/packs/*')
        .pipe(dest('./src/packs/'));
}

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

function buildWatch() {
    watch('src/**/*.scss', { ignoreInitial: false }, buildSASS);
    watch(
        ['src/templates', 'src/scripts', 'src/styles'], { ignoreInitial: false },
        copyFiles
    );
}

// Link build to User Data folder
async function linkUserData() {
    const packageJson = fs.readJSONSync('package.json');
    const name = path.basename(path.resolve(packageJson.name));
    const config = fs.readJSONSync('foundryconfig.json');

    let destDir;
    try {
        if (
            fs.existsSync(path.resolve('.', 'dist', 'module.json')) ||
            fs.existsSync(path.resolve('.', 'src', 'module.json'))
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
            await fs.symlink(path.resolve('./dist'), linkDir);
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
        } catch (err) {
            return reject(err);
        }
    });
}

function updateManifest(cb) {
    const packageJson = fs.readJSONSync('package.json');
    const config = getConfig(),
        manifest = getManifest(),
        downloadURL = config.downloadURL;
    //manifestRoot = manifest.root

    if (!config) cb(Error(chalk.red('foundryconfig.json not found')));
    if (!manifest) cb(Error(chalk.red('Manifest JSON not found')));
    if (!downloadURL)
        cb(
            Error(
                chalk.red(
                    'Download URL not configured in foundryconfig.json'
                )
            )
        );
    try {
        const version = argv.update || argv.u;

        /* Update version */

        const versionMatch = /^(\d{1,}).(\d{1,}).(\d{1,})$/;
        const currentVersion = manifest.file.version;
        let targetVersion = '';

        if (!version) {
            cb(Error('Missing version number'));
        }

        if (versionMatch.test(version)) {
            targetVersion = version;
        } else {
            targetVersion = currentVersion.replace(
                versionMatch,
                (substring, major, minor, patch) => {
                    console.log(
                        substring,
                        Number(major) + 1,
                        Number(minor) + 1,
                        Number(patch) + 1
                    );
                    if (version === 'major') {
                        return `${Number(major) + 1}.0.0`;
                    } else if (version === 'minor') {
                        return `${major}.${Number(minor) + 1}.0`;
                    } else if (version === 'patch') {
                        return `${major}.${minor}.${Number(patch) + 1}`;
                    } else {
                        return '';
                    }
                }
            );
        }

        if (targetVersion === '') {
            return cb(Error(chalk.red('Error: Incorrect version arguments.')));
        }

        packageJson.version = targetVersion;
        manifest.file.version = targetVersion;
        console.log(`Version number updated to to '${targetVersion}'`);

        // Update URLs

        //const moduleURL = `${rawURL}/latest`
        //const zipURL = `${rawURL}/package`
        //const result = `${zipURL}/${manifest.file.name}-v${manifest.file.version}.zip`

        manifest.file.update = `${downloadURL}/${manifest.name}`;
        manifest.file.manifest = manifest.file.update;
        manifest.file.download = `${downloadURL}/${manifest.file.id}-${manifest.file.version}.zip`;

        const prettyProjectJson = stringify(manifest.file, {
            maxLength: 35,
            indent: '\t',
        });

        fs.writeJSONSync('package.json', packageJson, { spaces: '\t' });
        fs.writeFileSync(
            path.join(manifest.root, manifest.name),
            prettyProjectJson,
            'utf8'
        );

        return cb();
    } catch (err) {
        cb(err);
    }
}

const execBuild = parallel(buildSASS, copyFiles);

exports.webp = convertToWebp;
exports.build = series(
    clean,
    execBuild
);
exports.watch = buildWatch;
exports.clean = clean;
exports.link = linkUserData;
exports.package = series(
    clean,
    execBuild,
    packageBuild
);
exports.update = updateManifest; //$ gulp --update="<major || minor || patch>"
exports.clone = copyFiles;
exports.copypacks = copyPacks;
exports.publish = series(
    clean,
    //updateManifest,
    execBuild,
    packageBuild
);
exports.default = series(clean, copyFiles);