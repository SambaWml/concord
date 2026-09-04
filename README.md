# Concord — MVP

Múltiplos servidores, cada um com seu próprio chat e chamada de voz/vídeo com compartilhamento de tela — como o Discord, num MVP enxuto. Web e executável desktop.

## O que já funciona

- **Conta com apelido + senha:** primeira vez com um apelido, a senha digitada vira a senha da conta; da próxima vez, precisa da senha certa pra voltar com aquele nome (veja "Contas" abaixo)
- **Múltiplos servidores:** crie o seu (ganha um código de convite na hora) ou entre num com o código de alguém — veja "Servidores" abaixo
- Chat em tempo real no canal `#geral` de cada servidor, com histórico salvo em Postgres — fecha o navegador, entra de novo, as mensagens continuam lá
- Lista de quem está online naquele servidor, atualizada em tempo real
- Canal de voz "Geral" por servidor: qualquer um entra, fala, liga câmera se quiser — todo mundo conectado direto um no outro (WebRTC), sem servidor de mídia pago no meio
- Supressão de ruído por IA (GTCRN) + realce de presença vocal (EQ/compressão), tudo processado no navegador
- Compartilhar tela na chamada, com tela cheia e volume por pessoa
- **Moderação:** o dono de um servidor modera só o que criou; quem está em `ADMIN_NICKNAMES` modera em todos — apagar mensagem, expulsar (temporário) ou banir (permanente, só naquele servidor) — veja "Definindo quem é admin" abaixo
- **Anti-spam:** no máximo 5 mensagens a cada 10 segundos por pessoa

## Servidores

Cada servidor é isolado: chat, chamada de voz e banimentos não vazam de um pro outro.

- **Criar:** botão "+" embaixo dos ícones de servidor → nome → ganha um código de convite na hora pra compartilhar
- **Entrar:** mesmo botão "+" → aba "Entrar com convite" → cola o código de 8 caracteres
- Todo mundo cai automaticamente no servidor **Geral** ao criar a conta — é o servidor padrão da instalação, sem dono definido
- O botão 👤+ no topo da lista de canais mostra (ou gera) o código de convite do servidor atual

## Contas

Login é só **apelido + senha** — sem e-mail, sem verificação. Regras simples:

- Apelido livre → a senha digitada cria a conta
- Apelido já existente → precisa da senha certa (se errar, é recusado)
- Apelido de uma conta criada **antes** desse recurso existir (sem senha ainda) → a primeira pessoa que entrar com uma senha "reivindica" o apelido; dali pra frente, só quem sabe essa senha volta com esse nome
- Depois de entrar, o navegador guarda um token de sessão (não a senha) — reabrir o app não pede senha de novo, a não ser que o servidor reinicie (Render redeploy, por exemplo) ou o token expire

Apelido não diferencia maiúscula/minúscula pra login (`Wesley` e `wesley` são a mesma conta).

## Definindo quem é admin

Tem dois níveis:

- **Dono do servidor:** quem cria um servidor modera só ele — kick/ban/apagar mensagem dentro do que criou, automaticamente, sem configurar nada.
- **Admin global:** lista de apelidos de confiança na variável de ambiente `ADMIN_NICKNAMES` (separados por vírgula) — modera em **qualquer** servidor. Como apelido tem dono (senha), só quem sabe a senha da conta consegue de fato entrar com esse nome:

```
ADMIN_NICKNAMES=Wesley,OutroAdmin
```

Local: coloque isso no `server/.env`. No Render: **Environment** → adicionar essa variável → salvar (reinicia sozinho). Quem entrar com um desses apelidos exatos vira admin e ganha um 👑 do lado do nome, além dos botões de expulsar/banir na lista de online e apagar mensagem de qualquer um no chat.

## Limitações conhecidas do MVP (de propósito)

- **Voz em malha (mesh):** cada participante se conecta direto com todo mundo. Funciona bem até uns 6–8 pessoas na chamada ao mesmo tempo; passando disso, a qualidade cai porque cada um está enviando vídeo/áudio pra todo mundo. Resolver isso é trabalho de uma fase futura (servidor de mídia / SFU).
- **Sem TURN por padrão:** usa só STUN público (grátis). Funciona na grande maioria das redes domésticas/4G. Se alguém não conseguir conectar a chamada (rede corporativa restrita), configure um TURN gratuito (ex: metered.ca) nas variáveis `VITE_TURN_URL/VITE_TURN_USERNAME/VITE_TURN_CREDENTIAL` do front.
- **Sem e-mail/recuperação de senha:** esqueceu a senha, perde o apelido — não tem "esqueci minha senha" ainda. Pra um grupo pequeno de confiança, ok; pra escala maior, precisaria de recuperação de verdade.
- **Ban ainda é best-effort:** agora que apelido tem senha, criar uma identidade nova exige escolher um apelido novo (não só limpar o navegador) — mais alto que antes, mas ainda não impede de vez quem realmente quiser voltar com outro nome.
- **Sessão não sobrevive a restart do servidor:** cada redeploy no Render limpa as sessões em memória — todo mundo precisa digitar a senha de novo (a conta em si não se perde, só a sessão).
- **Um canal de texto e um de voz por servidor:** por design, é o escopo deste MVP — múltiplos canais dentro do mesmo servidor fica pra depois.
- **Convite não expira nem tem limite de usos:** qualquer um com o código entra, pra sempre. Sem revogar convite ainda.

## Rodando local

Pré-requisitos: Node 18+.

```bash
npm run install:all
cp server/.env.example server/.env   # cole sua DATABASE_URL do Postgres
npm run dev
```

Abre em `http://localhost:5173`. O front fala com o back em `http://localhost:5000` via proxy do Vite.

Se você não tiver um Postgres à mão pra testar rapidinho, crie um gratuito em [neon.tech](https://neon.tech) (leva 2 minutos, plano free permanente) e cole a connection string em `server/.env`.

## Colocando no ar de graça (24h)

1. **Banco:** crie um projeto grátis em [neon.tech](https://neon.tech) → copie a *connection string*.
2. **Deploy:** crie uma conta em [render.com](https://render.com) → "New Web Service" → aponte pro repositório → Render detecta o `render.yaml` sozinho.
3. Em **Environment**, cole `DATABASE_URL` (a do Neon). Não precisa mexer em `CLIENT_ORIGIN` — sem ela definida, o servidor aceita a própria origem automaticamente.
4. Deploy. Primeiro build demora um pouco (build do front + instalação do back).

**Sobre o "grátis":** o plano free do Render "dorme" depois de ~15 min sem acesso — a primeira pessoa que abrir depois disso espera uns 30–50s o serviço acordar. As próximas pessoas entram na hora. O Postgres do Neon não some nesse meio tempo, ele só hiberna o processamento e acorda sozinho quando alguém consulta — suas mensagens continuam salvas.

## Executável desktop

`desktop/` é um app Electron que só abre uma janela nativa apontando pro Concord — a mesma estratégia do Discord de verdade (o cliente deles também é basicamente um navegador dedicado). Ele não roda servidor nenhum localmente; conversa com o mesmo backend publicado no Render.

```bash
cd desktop
npm install
npm start
```

Antes de gerar o instalador de verdade, edite `desktop/config.json` e troque `http://localhost:5000` pela URL publicada no Render — sem isso, o `.exe` só funcionaria na sua própria máquina com o servidor local rodando.

Pra gerar o instalador Windows (`.exe`):

```bash
npm run dist
```

O instalador sai em `desktop/dist/`. Câmera/microfone são liberados automaticamente (é sempre o nosso próprio site); compartilhar tela usa o seletor nativo do Windows quando disponível.

## Estrutura

```
server/    API + WebSocket (Express, Socket.io, Postgres)
web/       Front (React + Vite)
desktop/   Cliente desktop (Electron)
```

Em produção o `server` serve o build do `web` — um serviço só, um deploy só. O desktop aponta pra essa mesma URL publicada.
