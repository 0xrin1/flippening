const crypto = require('crypto');

const sha256 = async (message) => {
    return crypto.createHash('sha256').update(message).digest();
};

const randomSecretWord = () => {
    return getRandomString(Math.random() * 12);
};

const getRandomString = (length) => {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (let i = 0; i < length; i += 1) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
};

module.exports = {
    sha256,
    randomSecretWord,
};
