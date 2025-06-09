# RuaGO: Gestão Inteligente para o Comércio de Rua

## Overview

RuaGO é uma plataforma web projetada para revolucionar o comércio de rua, conectando vendedores ambulantes (como baianas de acarajé, vendedores de queijo na praia, pipoqueiros) a seus clientes em tempo real. A aplicação oferece um mapa interativo para visualização da localização dos vendedores, dashboards de gestão para os comerciantes, e funcionalidades de comunicação e assistência inteligente por IA.

## Key Features

*   **Mapa Interativo:** Visualização em tempo real de vendedores ambulantes ativos (Leaflet).
*   **Dashboard do Vendedor:**
    *   Gestão de status (aberto/fechado).
    *   Atualização de localização em tempo real.
    *   Gerenciamento de cardápio.
    *   Análise de histórico de localização.
    *   Assistente de Gestão IA (Gemini) para:
        *   Sugerir nomes para o ponto de venda.
        *   Gerar descrições de itens do cardápio.
        *   Analisar avaliações de clientes.
*   **Sistema de Avaliação:** Clientes podem avaliar os pontos de venda.
*   **Mensagens Diretas:** Comunicação em tempo real entre clientes e vendedores (Socket.IO).
*   **Chat com Assistente IA (Cliente):** Clientes podem conversar com um assistente virtual para tirar dúvidas.
*   **Autenticação:** Sistema de registro e login para clientes e vendedores.
*   **Design Responsivo:** Interface adaptável utilizando Tailwind CSS.

## Tech Stack

*   **Backend:**
    *   Node.js
    *   Express.js
    *   MongoDB (com Mongoose)
    *   Socket.IO (para comunicação em tempo real)
    *   JSON Web Tokens (JWT) para autenticação
    *   Bcrypt.js (para hashing de senhas)
    *   Google Generative AI (Gemini)
    *   Helmet (para segurança HTTP)
    *   Express-rate-limit (para limitar tentativas de autenticação)
    *   dotenv (para gerenciamento de variáveis de ambiente)
    *   cors (para Cross-Origin Resource Sharing)
*   **Frontend:**
    *   HTML5
    *   Tailwind CSS (via CDN no `index.html`)
    *   Vanilla JavaScript
    *   Leaflet.js (para mapas)
    *   Font Awesome (para ícones, via CDN no `index.html`)
    *   Socket.IO Client
*   **Database:**
    *   MongoDB (NoSQL)
*   **Testing:**
    *   Mocha
    *   Chai
    *   chai-http (para testes de API)
    *   socket.io-client (para testes de Socket.IO)

## Prerequisites for Local Development

*   [Node.js](https://nodejs.org/) (versão LTS recomendada, ex: 18.x ou superior)
*   [npm](https://www.npmjs.com/) (geralmente vem com Node.js)
*   [MongoDB](https://www.mongodb.com/try/download/community) instalado e rodando localmente, ou acesso a uma instância MongoDB (e.g., Atlas).

## Getting Started (Local Setup)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```
    (O `package.json` lista todas as dependências necessárias como: `express`, `mongoose`, `cors`, `bcryptjs`, `jsonwebtoken`, `dotenv`, `socket.io`, `@google/generative-ai`, `helmet`, `express-rate-limit`, etc., e devDependencies como `mocha`, `chai`, etc.)

3.  **Set up environment variables:**
    *   Crie um arquivo `.env` na raiz do projeto.
    *   Copie o conteúdo de `.env.example` para o seu arquivo `.env`.
    *   Preencha as variáveis no arquivo `.env` com suas configurações (veja `.env.example` para a lista de variáveis e seus propósitos).

4.  **Ensure MongoDB is running:**
    *   Se estiver usando uma instância local, inicie seu servidor MongoDB.
    *   Verifique se a `MONGO_URI` no seu `.env` está correta e aponta para o seu banco de dados de desenvolvimento (e.g., `ruago_dev`).

5.  **Run the backend server:**
    ```bash
    npm start
    ```
    (Este comando executa `node server.js` conforme definido no `package.json`.)
    O servidor backend deverá estar rodando em `http://localhost:PORT` (o `PORT` definido no seu `.env`, e.g., 3000). Você deverá ver logs como "Server running on port 3000" e "MongoDB Connected".

6.  **Access the frontend:**
    *   Abra o arquivo `index.html` diretamente no seu navegador (e.g., clicando duas vezes no arquivo ou usando uma extensão de live server como a do VSCode).
    *   A `API_URL` no `index.html` é configurada para se conectar a `http://localhost:3000` por padrão em ambiente de desenvolvimento local.

## Running Tests

Para rodar a suíte de testes automatizados para o backend:

```bash
npm test
```
(Este comando executa `mocha --timeout 30000 --exit` conforme definido no `package.json`.)
Certifique-se de que seu MongoDB de teste (configurado na `MONGO_URI` do `.env` ou uma URI de teste específica se o código de teste a sobrescrever - atualmente usa a mesma URI do `.env`) esteja acessível e que o servidor de teste possa ser iniciado. Os testes podem falhar se o MongoDB não estiver acessível, como observado em execuções anteriores.

## Deployment

Para instruções detalhadas sobre como fazer o deploy da aplicação para um ambiente de produção, por favor, consulte o arquivo [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## Contributing

Contribuições são bem-vindas! Por favor, siga as diretrizes padrão para fork, branch, commit e pull request. Discuta mudanças significativas via issues antes de submeter um PR.

## License

Este projeto é licenciado sob a Licença MIT. (Nota: Um arquivo `LICENSE` com o texto da licença MIT precisaria ser adicionado ao repositório para formalizar isso.)
