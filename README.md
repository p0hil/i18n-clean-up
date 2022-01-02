# Clean up tool for i18n
This tool helps to find & remove unused translations

### How to use it
1. Clone the repo
2. Make `sudo npm i -g` for ability to run it globally
3. Run `it i18n-clean --help` for usage options

### Examples
Find duplicates & remove it: `i18n-clean duplicates --remove translation.json`

Find useless translations & remove it: `i18n-clean usages --remove translation.json ./`
