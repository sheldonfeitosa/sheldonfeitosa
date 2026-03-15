const https = require('https');

/**
 * api/publish.js 
 * Versão para Produção (Vercel)
 * Usa a API do GitHub para persistir os posts e atualizar o site estático.
 */

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        return res.status(500).json({
            error: 'Integração com GitHub não configurada (Vercel Env Vars). Configure GITHUB_TOKEN e GITHUB_REPO.'
        });
    }

    try {
        const post = req.body;
        if (!post.title || !post.content) {
            return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });
        }

        const date = new Date(post.date || Date.now());
        const filename = `posts/${date.getTime()}-${post.title.toLowerCase().replace(/\s+/g, '-')}.json`;

        console.log(`Iniciando publicação no GitHub: ${filename}`);

        // 1. Obter todos os posts atuais para gerar o novo HTML
        const allPosts = await fetchAllPosts(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH);
        // Adicionar o novo post
        allPosts.push(post);
        allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 2. Gerar conteúdos atualizados
        const newPostContent = JSON.stringify(post, null, 2);
        const newIndexHtml = await generateUpdatedIndex(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, allPosts);
        const newFeedXml = generateFeedXml(allPosts);

        // 3. Salvar no GitHub (sequencial para simplicidade)
        await uploadToGithub(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, filename, newPostContent, `Add post: ${post.title}`);
        await uploadToGithub(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, 'index.html', newIndexHtml, `Update index for: ${post.title}`);
        await uploadToGithub(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, 'feed.xml', newFeedXml, `Update feed for: ${post.title}`);

        res.status(200).json({ success: true, message: 'Artigo publicado com sucesso no GitHub!' });
    } catch (err) {
        console.error('Erro ao publicar no GitHub:', err);
        res.status(500).json({ error: 'Erro ao salvar no GitHub: ' + err.message });
    }
};

async function fetchAllPosts(token, repo, branch) {
    const posts = [];
    try {
        const url = `/repos/${repo}/contents/posts?ref=${branch}`;
        const files = await githubRequest(token, 'GET', url);

        if (Array.isArray(files)) {
            for (const file of files) {
                if (file.name.endsWith('.json')) {
                    const content = await githubRequest(token, 'GET', `/repos/${repo}/contents/${file.path}?ref=${branch}`);
                    const json = JSON.parse(Buffer.from(content.content, 'base64').toString('utf8'));
                    posts.push(json);
                }
            }
        }
    } catch (e) {
        console.log('Pasta posts não encontrada ou vazia.');
    }
    return posts;
}

async function generateUpdatedIndex(token, repo, branch, posts) {
    const file = await githubRequest(token, 'GET', `/repos/${repo}/contents/index.html?ref=${branch}`);
    let index = Buffer.from(file.content, 'base64').toString('utf8');

    const startMarker = '<!-- BLOG_LIST_START -->';
    const endMarker = '<!-- BLOG_LIST_END -->';

    let htmlContent = '';
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

    const startIdx = index.indexOf(startMarker);
    const endIdx = index.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
        const before = index.substring(0, startIdx + startMarker.length);
        const after = index.substring(endIdx);
        return before + '\n' + htmlContent + '\n' + after;
    }
    return index;
}

function generateFeedXml(posts) {
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
    return feed;
}

async function uploadToGithub(token, repo, branch, path, content, message) {
    let sha;
    try {
        const existing = await githubRequest(token, 'GET', `/repos/${repo}/contents/${path}?ref=${branch}`);
        sha = existing.sha;
    } catch (e) {
        // Arquivo novo
    }

    const body = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch
    };
    if (sha) body.sha = sha;

    return githubRequest(token, 'PUT', `/repos/${repo}/contents/${path}`, body);
}

function githubRequest(token, method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path,
            method,
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'Vercel-Serverless-Function',
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else {
                    reject(new Error(`GitHub API Error: ${res.statusCode} ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}
