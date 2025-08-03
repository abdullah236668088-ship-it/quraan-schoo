// src/utils/arabicReshaper.js

const ARABIC_LETTERS = {
    0x0621: [0xfe80], // Hamza
    0x0622: [0xfe81, 0xfe82], // Alef with Madda Above
    0x0623: [0xfe83, 0xfe84], // Alef with Hamza Above
    0x0624: [0xfe85, 0xfe86], // Waw with Hamza Above
    0x0625: [0xfe87, 0xfe88], // Alef with Hamza Below
    0x0626: [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], // Yeh with Hamza Above
    0x0627: [0xfe8d, 0xfe8e], // Alef
    0x0628: [0xfe8f, 0xfe90, 0xfe91, 0xfe92], // Baa
    0x0629: [0xfe93, 0xfe94], // Taa Marbuta
    0x062a: [0xfe95, 0xfe96, 0xfe97, 0xfe98], // Taa
    0x062b: [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], // Thaa
    0x062c: [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0], // Jeem
    0x062d: [0xfea1, 0xfea2, 0xfea3, 0xfea4], // Haa
    0x062e: [0xfea5, 0xfea6, 0xfea7, 0xfea8], // Khaa
    0x062f: [0xfea9, 0xfeaa], // Dal
    0x0630: [0xfeab, 0xfeac], // Thal
    0x0631: [0xfead, 0xfeae], // Ra
    0x0632: [0xfeaf, 0xfeb0], // Zain
    0x0633: [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], // Seen
    0x0634: [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8], // Sheen
    0x0635: [0xfeb9, 0xfeba, 0xfebb, 0xfebc], // Sad
    0x0636: [0xfebd, 0xfebe, 0xfebf, 0xfec0], // Dad
    0x0637: [0xfec1, 0xfec2, 0xfec3, 0xfec4], // Tah
    0x0638: [0xfec5, 0xfec6, 0xfec7, 0xfec8], // Zah
    0x0639: [0xfec9, 0xfeca, 0xfecb, 0xfecc], // Ain
    0x063a: [0xfecd, 0xfece, 0xfecf, 0xfed0], // Ghain
    0x0641: [0xfed1, 0xfed2, 0xfed3, 0xfed4], // Fa
    0x0642: [0xfed5, 0xfed6, 0xfed7, 0xfed8], // Qaf
    0x0643: [0xfed9, 0xfeda, 0xfedb, 0xfedc], // Kaf
    0x0644: [0xfedd, 0xfede, 0xfedf, 0xfee0], // Lam
    0x0645: [0xfee1, 0xfee2, 0xfee3, 0xfee4], // Meem
    0x0646: [0xfee5, 0xfee6, 0xfee7, 0xfee8], // Noon
    0x0647: [0xfee9, 0xfeea, 0xfeeb, 0xfeec], // Ha
    0x0648: [0xfeed, 0xfeee], // Waw
    0x0649: [0xfeef, 0xfef0], // Alef Maksura
    0x064a: [0xfef1, 0xfef2, 0xfef3, 0xfef4], // Yeh
};

const NON_CONNECTING_CHARS = new Set([
    0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0627, // Hamza, Alefs, Waw Hamza
    0x062f, 0x0630, // Dal, Thal
    0x0631, 0x0632, // Ra, Zain
    0x0648, 0x0649, // Waw, Alef Maksura
    0x0629, // Taa Marbuta
]);

const isArabicChar = (char) => {
    const code = char.charCodeAt(0);
    return (code >= 0x0600 && code <= 0x06FF) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF);
};

const getCharForms = (char) => ARABIC_LETTERS[char.charCodeAt(0)];

const connectsToPrevious = (char) => {
    const forms = getCharForms(char);
    return forms && forms.length > 1;
};

export const processArabic = (text) => {
    if (!text) {
        return '';
    }

    const chars = Array.from(text);
    const reshapedChars = [];

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const forms = getCharForms(char);

        if (!isArabicChar(char) || !forms) {
            reshapedChars.push(char);
            continue;
        }

        const prevChar = i > 0 ? chars[i - 1] : null;
        const nextChar = i < chars.length - 1 ? chars[i + 1] : null;

        const prevConnects = prevChar && isArabicChar(prevChar) && !NON_CONNECTING_CHARS.has(prevChar.charCodeAt(0));
        const nextConnects = nextChar && isArabicChar(nextChar) && !NON_CONNECTING_CHARS.has(char.charCodeAt(0)) && connectsToPrevious(nextChar);

        // Handle Lam-Alef ligature
        if (char.charCodeAt(0) === 0x0644 && nextChar && [0x0622, 0x0623, 0x0625, 0x0627].includes(nextChar.charCodeAt(0))) {
            let ligatureCode;
            const alefCode = nextChar.charCodeAt(0);
            if (alefCode === 0x0622) ligatureCode = prevConnects ? 0xFEF6 : 0xFEF5; // Lam + Alef with Madda
            else if (alefCode === 0x0623) ligatureCode = prevConnects ? 0xFEF8 : 0xFEF7; // Lam + Alef with Hamza Above
            else if (alefCode === 0x0625) ligatureCode = prevConnects ? 0xFEFA : 0xFEF9; // Lam + Alef with Hamza Below
            else if (alefCode === 0x0627) ligatureCode = prevConnects ? 0xFEFC : 0xFEFB; // Lam + Alef

            if (ligatureCode) {
                reshapedChars.push(String.fromCharCode(ligatureCode));
                i++; // Skip the Alef
                continue;
            }
        }

        let formIndex = 0; // 0: Isolated, 1: Final, 2: Initial, 3: Medial
        if (prevConnects && nextConnects) {
            formIndex = 3; // Medial
        } else if (prevConnects) {
            formIndex = 1; // Final
        } else if (nextConnects) {
            formIndex = 2; // Initial
        }

        // Fallback for characters with fewer forms
        if (formIndex >= forms.length) {
            formIndex = forms.length - 1;
        }

        // Fallback for characters with only two forms (isolated, final)
        if (forms.length === 2 && formIndex > 1) {
            formIndex = 1; // Use final form if connection from previous is possible
        }

        reshapedChars.push(String.fromCharCode(forms[formIndex]));
    }
    return reshapedChars.join('');
};
