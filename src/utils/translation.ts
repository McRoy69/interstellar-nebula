export const TARGET_LANGS = ['de', 'es', 'tr', 'pt', 'ta'];

export async function translateText(text: string, to: string): Promise<string> {
    if (!text) return '';
    try {
        const response = await fetch(`/api/translate?text=${encodeURIComponent(text)}&to=${to}`);
        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        return data.translatedText;
    } catch (e) {
        console.error('Translation error:', e);
        return text; // Fallback to original
    }
}

export async function getTaskTranslations(title: string, anlage: string) {
    const translations: { [lang: string]: { title: string; anlage: string } } = {};

    // We do them sequentially to avoid overwhelming the unofficial API if needed, 
    // but Promise.all is faster. Let's use Promise.all.
    await Promise.all(TARGET_LANGS.map(async (lang) => {
        try {
            const [tTitle, tAnlage] = await Promise.all([
                translateText(title, lang),
                translateText(anlage, lang)
            ]);
            translations[lang] = { title: tTitle, anlage: tAnlage };
        } catch (err) {
            console.error(`Failed to translate to ${lang}:`, err);
            translations[lang] = { title, anlage };
        }
    }));

    return translations;
}
