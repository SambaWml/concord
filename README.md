# Concord — MVP

Um servidor "Geral" único: chat de texto persistente + chamada de voz/vídeo em grupo. Web hoje, executável desktop na Fase 2 (veja o [Concord Blueprint](.) para o roadmap completo).

## O que já funciona

- Entrar com um apelido (fica salvo no navegador, sem senha por enquanto)
- Chat em tempo real no canal `#geral`, com histórico salvo em Postgres — fecha o navegador, entra de novo, as mensagens continuam lá
- Lista de quem está online, atualizada em tempo real
- Canal de voz "Geral": qualquer um entra, fala, liga câmera se quiser — todo mundo conectado direto um no outro (WebRTC), sem servidor de mídia pago no meio

## Limitações conhecidas do MVP (de propósito)

- **Voz em malha (mesh):** cada participante se conecta direto com todo mundo. Funciona bem até uns 6–8 pessoas na chamada ao mesmo tempo; passando disso, a qualidade cai porque cada um está enviando vídeo/áudio pra todo mundo. Resolver isso é a Fase 3 do blueprint (servidor de mídia / SFU).
- **Sem TURN por padrão:** usa só STUN público (grátis). Funciona na grande maioria das redes domésticas/4G. Se alguém não conseguir conectar a chamada (rede corporativa restrita), configure um TURN gratuito (ex: metered.ca) nas variáveis `VITE_TURN_URL/VITE_TURN_USERNAME/VITE_TURN_CREDENTIAL` do front.
- **Sem senha ainda:** identidade é só um apelido salvo no navegador. Qualquer um pode se passar por qualquer nome — ok pra um grupo de confiança, não pronto pra público aberto.
- **Um servidor só, um canal de texto só:** por design, é o escopo deste MVP.

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

## Estrutura

```
server/   API + WebSocket (Express, Socket.io, Postgres)
web/      Front (React + Vite)
```

Em produção o `server` serve o build do `web` — um serviço só, um deploy só.
