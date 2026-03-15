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
            htmlContent += `
                <article class="blog-card">
                    <div class="blog-card-content">
                        <span class="blog-category">${post.category}</span>
                        <span class="blog-date">${dateStr}</span>
                        <h3>${post.title}</h3>
                        <p>${post.content.substring(0, 150)}...</p>
                        <a href="#" class="link-arrow">Ler Artigo &rarr;</a>
                    </div>
                </article>`;
        });
    }

    // 4. Injetar no index.html
    if (fs.existsSync(indexPath)) {
        let index = fs.readFileSync(indexPath, 'utf8');
        const startMarker = '<!-- BLOG_LIST_START -->';
        const endMarker = '<!-- BLOG_LIST_END -->';

        const startIdx = index.indexOf(startMarker);
        const endIdx = index.indexOf(endMarker);

        if (startIdx !== -1 && endIdx !== -1) {
            const before = index.substring(0, startIdx + startMarker.length);
            const after = index.substring(endIdx);
            fs.writeFileSync(indexPath, before + '\n' + htmlContent + '\n' + after);
            console.log('✅ index.html atualizado.');
        } else {
            console.error('❌ Marcadores BLOG_LIST_START/END não encontrados no index.html');
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

module.exports = publish;
