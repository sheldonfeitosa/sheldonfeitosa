const express = require('express');
const fs = require('fs');
const path = require('path');
const publish = require('./publish');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname)); // Serve o site estático
app.use('/admin', express.static(path.join(__dirname, 'admin')));

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

// Rota raiz do admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Painel do Blog rodando em http://localhost:${PORT}/admin`);
});
