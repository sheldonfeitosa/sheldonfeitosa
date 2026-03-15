const express = require('express');
const fs = require('fs');
const path = require('path');
const publish = require('./publish');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // Serve o site estático
app.use('/painel', express.static(path.join(__dirname, 'painel')));

// API para publicar um novo artigo
app.post('/api/publish', (req, res) => {
    try {
        const post = req.body;
        if (!post.title || !post.content) {
            return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });
        }

        // Criar nome de arquivo amigável
        const filename = `${Date.now()}-${post.title.toLowerCase().replace(/\s+/g, '-')}.json`;
        const postsDir = path.join(__dirname, 'posts');

        if (!fs.existsSync(postsDir)) {
            fs.mkdirSync(postsDir);
        }

        // 1. Salvar Post JSON
        fs.writeFileSync(path.join(postsDir, filename), JSON.stringify(post, null, 2));
        console.log(`✅ Post salvo: ${filename}`);

        // 2. Executar o motor de publicação
        publish();

        res.status(200).json({ success: true, message: 'Artigo publicado com sucesso!' });
    } catch (err) {
        console.error('Erro na API de publicação:', err);
        res.status(500).json({ error: 'Erro interno ao publicar o artigo.' });
    }
});

// API para listar todos os artigos
app.get('/api/posts', (req, res) => {
    const postsDir = path.join(__dirname, 'posts');
    if (!fs.existsSync(postsDir)) return res.json([]);

    const files = fs.readdirSync(postsDir);
    const posts = files
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const content = JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8'));
            return { filename: f, ...content };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(posts);
});

// API para deletar um artigo
app.delete('/api/posts/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, 'posts', filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Post deletado: ${filename}`);
            publish();
            res.json({ success: true, message: 'Artigo excluído com sucesso!' });
        } else {
            res.status(404).json({ error: 'Artigo não encontrado.' });
        }
    } catch (err) {
        console.error('Erro ao deletar post:', err);
        res.status(500).json({ error: 'Erro interno ao excluir o artigo.' });
    }
});

// Rota raiz do admin
app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, 'painel', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Painel do Blog rodando em http://localhost:${PORT}/painel`);
});
