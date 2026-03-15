const fs = require('fs');
const path = require('path');

/**
 * publish.js
 * Responsável por ler os arquivos JSON em /posts e atualizar index.html e feed.xml
 */

function publish() {
    const postsDir = path.join(__dirname, 'posts');
    const indexPath = path.join(__dirname, 'index.html');
    const feedPath = path.join(__dirname, 'feed.xml');

    // 1. Ler todos os posts
    let posts = [];
    if (fs.existsSync(postsDir)) {
        const files = fs.readdirSync(postsDir);
        posts = files
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')));
    }

    // 2. Ordenar por data (mais recente primeiro)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 3. Gerar HTML para o index.html
    let htmlContent = '';
    if (posts.length === 0) {
        htmlContent = '<p style="text-align: center; grid-column: 1/-1; padding: 40px; color: #64748b;">Nenhum artigo publicado ainda.</p>';
    } else {
        posts.forEach(post => {
            const dateStr = new Date(post.date).toLocaleDateString('pt-BR');
            // Mapear categoria para placeholder de cor do CSS
            let placeholderClass = 'placeholder-management';
            const cat = (post.category || '').toLowerCase();
            if (cat.includes('tec') || cat.includes('api')) placeholderClass = 'placeholder-tech';
            if (cat.includes('qualid') || cat.includes('saúde')) placeholderClass = 'placeholder-quality';

            // Lógica de Vídeo
            let videoHtml = '';
            if (post.videoUrl) {
                const videoId = extractYoutubeId(post.videoUrl);
                if (videoId) {
                    videoHtml = `<div class="blog-video" style="margin-bottom: 15px; border-radius: 8px; overflow: hidden; aspect-ratio: 16/9;">
                        <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>`;
                }
            }

            htmlContent += `
                <article class="blog-card">
                    ${videoHtml ? videoHtml : `<div class="blog-image ${placeholderClass}"></div>`}
                    <div class="blog-content">
                        <span class="blog-tag">${post.category}</span>
                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 10px;">${dateStr}</span>
                        <h3 style="margin-top: 10px;">${post.title}</h3>
                        <p>${post.content.substring(0, 150)}...</p>
                        <a href="#" class="read-more">Ler Artigo &rarr;</a>
                    </div>
                </article>`;
        });
    }

    // 4. Injetar no index.html
    if (fs.existsSync(indexPath)) {
        let index = fs.readFileSync(indexPath, 'utf8');
        const startMarker = '<!-- BLOG_LIST_START -->';
        const endMarker = '<!-- BLOG_LIST_END -->';

        // Busca robusta pelos marcadores
        const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
        if (regex.test(index)) {
            fs.writeFileSync(indexPath, index.replace(regex, `${startMarker}\n${htmlContent}\n${endMarker}`));
            console.log('✅ index.html atualizado.');
        } else {
            console.warn('Marcadores não encontrados via Regex. Tentando busca exata.');
            const startIdx = index.indexOf(startMarker);
            const endIdx = index.indexOf(endMarker);

            if (startIdx !== -1 && endIdx !== -1) {
                const before = index.substring(0, startIdx + startMarker.length);
                const after = index.substring(endIdx);
                fs.writeFileSync(indexPath, before + '\n' + htmlContent + '\n' + after);
                console.log('✅ index.html atualizado (busca exata).');
            } else {
                console.error('❌ Marcadores BLOG_LIST_START/END não encontrados no index.html');
            }
        }
    }

    // 5. Atualizar feed.xml (RSS simplificado)
    if (fs.existsSync(feedPath)) {
        let feed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
    <title>Blog | Sheldon Feitosa</title>
    <description>Insights sobre Gestão de Saúde, Qualidade e Tecnologia.</description>
    <link>https://sheldonfeitosa.com.br</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;
        posts.slice(0, 10).forEach(post => {
            feed += `
    <item>
        <title>${post.title}</title>
        <link>https://sheldonfeitosa.com.br#blog</link>
        <description>${post.content.substring(0, 200)}...</description>
        <pubDate>${new Date(post.date).toUTCString()}</pubDate>
        <category>${post.category}</category>
    </item>`;
        });
        feed += `\n</channel>\n</rss>`;
        fs.writeFileSync(feedPath, feed);
        console.log('✅ feed.xml atualizado.');
    }
}

// Se executado diretamente
if (require.main === module) {
    publish();
}

function extractYoutubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

module.exports = publish;
