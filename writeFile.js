const writeFile = (filename, content) => {
    const fs = require('fs')

    fs.writeFile(filename, content, (err) => {
        if (err) {
            console.error(err)
            return;
        }
    })
}

module.exports = writeFile;