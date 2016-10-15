const path = require('path');

export default {

    isInHierarchy: (directory, filename) => {
        const relativePath = path.relative(directory, filename);
        return relativePath.indexOf(`..${path.sep}`) === -1;
    }
}