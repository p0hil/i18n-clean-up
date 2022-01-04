#! /usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require("path");
const _ = require("lodash");
const chalk = require("chalk");

const template = "I18n\\.t\\(\\s*['\"]:key['\"][^\\)]*\\)";

function findDuplicates(file, options, command) {
    let fileName = path.resolve(file);
    if (!fs.existsSync(fileName)) {
        console.error(`File "${fileName}" does not exists`);
        return;
    }

    let json = require(fileName);
    let inverse = {};
    for (let key in json) {
        let value = json[key];
        if (!inverse[value]) {
            inverse[value] = [];
        }
        inverse[value].push(key);
    }

    let duplicates = _.pickBy(inverse, v => v.length > 1);
    console.log(`Found ${Object.values(duplicates).length} duplicates`);

    let removed = [];
    for (let value in duplicates) {
        let keys = duplicates[value];
        console.log(`Translation "${chalk.bold(value)}", keys: ${chalk.bold(keys.join(', '))}`);
        if (options.remove) {
            keys.shift();
            removed.push(...keys);
            _.each(keys, k => delete json[k]);
            console.log(`Removed keys: ${chalk.bold(keys.join(', '))}`);
        }
    }

    if (options.remove && removed.length > 0) {
        fs.writeFileSync(fileName, JSON.stringify(json, null, 2));
        console.log(chalk.green('File has been saved successfully!'));
    }
}

function findFiles(dir, mask) {
    let files = [];
    let dirs = [dir];

    while (dirs.length > 0) {
        dir = dirs.shift();
        fs.readdirSync(dir).forEach(file => {
            const fileName = path.resolve(path.join(dir, file));
            if (fs.statSync(fileName).isDirectory()) {
                dirs.push(fileName);
            }
            else {
                if (mask.test(file)) {
                    files.push(fileName);
                }
            }
        });
    }
    return files;
}

async function findUsagesInFile(file, keys, template) {
    return new Promise(resolve => {
        fs.readFile(file, null, (err, content) => {
            let usages = {};
            _.map(keys, k => usages[k] = 0);

            for (let key of keys) {
                let re = new RegExp(template.replace(':key', key), 'ig');
                let matches = content.toString().match(re);
                if (matches) {
                    usages[key] += matches.length;
                }
            }

            resolve(usages, file);
        });
    });
}

async function findUsages(file, dir, options) {
    if (options.mask && typeof options.mask !== 'string') {
        console.error(chalk.red.bold('Mask should be a string'));
        return;
    }

    let fileName = path.resolve(file);
    if (!fs.existsSync(fileName)) {
        console.error(`File "${fileName}" not exists`);
        return;
    }

    let translations = require(fileName);

    const fileRegex = new RegExp('(' + (options.mask || 'js,jsx,ts,tsx').split(',').map(_.trim).map(s => '.' + s).join('|') + ')$');
    let files = findFiles(dir, fileRegex);

    let usages = {};
    Object.keys(translations).map(k => usages[k] = { key: k, count: 0, files: [] });

    const sumUsages = (result, file) => {
        for (let k in result) {
            if (result[k] > 0) {
                usages[k].count += result[k];
                usages[k].files.push(file);
            }
        }
    }

    let waits = [];
    for (let file of files) {
        waits.push(findUsagesInFile(file, Object.keys(usages), template).then(sumUsages));
    }

    await Promise.all(waits);

    let results = Object.values(usages).sort((i1, i2) => i2.count - i1.count);
    let removed = [];
    let used = 0, useless = 0;
    for (let item of results) {
        if (item.count > 0) {
            console.log(`Translation "${chalk.bold(item.key)}", usages: ${chalk.bold(item.count)}`);
            used++;
        }
        else {
            console.log(`Translation "${chalk.red.bold(item.key)}" have no usages`);
            if (options.remove) {
                delete translations[item.key];
                removed.push(item.key);
            }
            useless++;
        }
    }

    console.log(chalk.magenta.bold(`\nTotal translations: ${results.length}, used: ${used}, useless ${useless}`));

    if (options.remove && removed.length > 0) {
        fs.writeFileSync(fileName, JSON.stringify(translations, null, 2));
        console.log(chalk.red(`Removed ${removed.length} useless translation(s)`));
        console.log(chalk.green(`File was saved successfully!`));
    }
}

program
    .command('duplicates <file>')
    .description('List all value duplicates in translation file')
    .option('-r, --remove', 'Remove found duplicates')
    .action(findDuplicates);

program
    .command('template')
    .description('Show template')
    .action(function() {
        console.log(chalk.cyan(template));
    });

program
    .command('usages <file> <directory>')
    .description('List all value duplicates in translation file')
    .option('-r, --remove', 'Remove unused translations from file')
    .option('-m, --mask', 'Files mask to search in')
    .action(findUsages);

program.parse();
